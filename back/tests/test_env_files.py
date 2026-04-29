import subprocess
import sys
from pathlib import Path

from infrastructure.env_files import load_env_files, parse_env_file_content
from scripts.run_with_env_files import resolve_command_executable


def test_parse_env_file_content_preserves_values_with_spaces_and_backslashes():
    parsed = parse_env_file_content(
        "PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\n"
        "API_SPORTS_LEAGUE_IDS=39, 61, 78\n"
        "# comment\n"
        "SQLALCHEMY_DATABASE_URL=postgresql://user:pass@example.test/db?sslmode=require&channel_binding=require\n"
    )

    assert parsed == {
        "PRIVATE_KEY": "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----",
        "API_SPORTS_LEAGUE_IDS": "39, 61, 78",
        "SQLALCHEMY_DATABASE_URL": "postgresql://user:pass@example.test/db?sslmode=require&channel_binding=require",
    }


def test_load_env_files_merges_multiple_files_with_later_override(tmp_path: Path):
    backend_env = tmp_path / "backend.env"
    backend_env.write_text("ENVIRONMENT=prod\nPRIVATE_KEY=-----BEGIN PRIVATE KEY-----\\nabc\n", encoding="utf-8")

    migrations_env = tmp_path / "migrations.env"
    migrations_env.write_text("ALEMBIC_DATABASE_URL=postgresql://migrate@example.test/db\nENVIRONMENT=override\n", encoding="utf-8")

    loaded = load_env_files([str(backend_env), str(migrations_env)])

    assert loaded["PRIVATE_KEY"] == "-----BEGIN PRIVATE KEY-----\\nabc"
    assert loaded["ALEMBIC_DATABASE_URL"] == "postgresql://migrate@example.test/db"
    assert loaded["ENVIRONMENT"] == "override"


def test_parse_env_file_content_rejects_invalid_env_var_names():
    try:
        parse_env_file_content("BAD KEY=value\n")
    except ValueError as exc:
        assert "Invalid environment variable name" in str(exc)
    else:
        raise AssertionError("Expected ValueError for invalid env var name")


def test_parse_env_file_content_rejects_dangerous_process_env_keys():
    try:
        parse_env_file_content("PATH=/tmp/malicious\n")
    except ValueError as exc:
        assert "is not allowed" in str(exc)
    else:
        raise AssertionError("Expected ValueError for blocked env key")


def test_parse_env_file_content_rejects_shell_startup_env_keys():
    for key in ("ENV", "BASH_ENV", "IFS", "SHELLOPTS"):
        try:
            parse_env_file_content(f"{key}=malicious\n")
        except ValueError as exc:
            assert "is not allowed" in str(exc)
        else:
            raise AssertionError(f"Expected ValueError for blocked env key {key}")


def test_resolve_command_executable_uses_current_path_before_env_files(monkeypatch):
    monkeypatch.setenv("PATH", "/usr/bin:/bin")
    resolved = resolve_command_executable(["python3", "-V"])

    assert resolved.startswith("/")
    assert resolved.endswith("python3")


def test_run_with_env_files_can_be_executed_as_script(tmp_path: Path):
    env_file = tmp_path / "backend.env"
    env_file.write_text("BETLEAGUE_TEST_VALUE=ok-from-env-file\n", encoding="utf-8")

    project_root = Path(__file__).resolve().parents[1]
    result = subprocess.run(
        [
            sys.executable,
            "scripts/run_with_env_files.py",
            str(env_file),
            "--",
            sys.executable,
            "-c",
            "import os; print(os.environ['BETLEAGUE_TEST_VALUE'])",
        ],
        cwd=project_root,
        check=True,
        capture_output=True,
        text=True,
    )

    assert result.stdout.strip() == "ok-from-env-file"


