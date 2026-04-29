import os
import subprocess
import sys
from pathlib import Path

from infrastructure.env_files import load_env_files, parse_env_file_content
from scripts.run_with_env_files import ensure_project_root_in_pythonpath, resolve_command_executable


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


def test_run_with_env_files_propagates_project_root_to_python_children(tmp_path: Path):
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
            "from infrastructure.env_files import parse_env_file_content; print(parse_env_file_content('CHILD_IMPORT=ok')['CHILD_IMPORT'])",
        ],
        cwd=project_root,
        env={"PATH": os.environ["PATH"]},
        check=True,
        capture_output=True,
        text=True,
    )

    assert result.stdout.strip() == "ok"


def test_ensure_project_root_in_pythonpath_preserves_existing_entries(monkeypatch):
    monkeypatch.setenv("PYTHONPATH", "/opt/custom")

    ensure_project_root_in_pythonpath()

    entries = os.environ["PYTHONPATH"].split(os.pathsep)
    assert entries[0] == str(Path(__file__).resolve().parents[1])
    assert "/opt/custom" in entries


def test_alembic_script_location_is_relative_to_config_file():
    project_root = Path(__file__).resolve().parents[1]
    alembic_ini = project_root / "alembic.ini"

    assert "script_location = %(here)s/alembic" in alembic_ini.read_text(encoding="utf-8")


def test_run_migrations_script_unsets_pythonpath_and_runs_outside_project_root(tmp_path: Path):
    project_root = Path(__file__).resolve().parents[1]
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()

    cwd_file = tmp_path / "cwd.txt"
    pythonpath_file = tmp_path / "pythonpath.txt"
    args_file = tmp_path / "args.txt"
    fake_alembic = fake_bin / "alembic"
    fake_alembic.write_text(
        "#!/bin/sh\n"
        "printf '%s' \"$PWD\" > \"$TEST_CWD_FILE\"\n"
        "printf '%s' \"${PYTHONPATH-}\" > \"$TEST_PYTHONPATH_FILE\"\n"
        "printf '%s\\n' \"$@\" > \"$TEST_ARGS_FILE\"\n",
        encoding="utf-8",
    )
    fake_alembic.chmod(0o755)

    env = {
        "PATH": f"{fake_bin}{os.pathsep}{os.environ['PATH']}",
        "PYTHONPATH": str(project_root),
        "ALEMBIC_UPGRADE_MAX_RETRIES": "1",
        "ALEMBIC_UPGRADE_RETRY_DELAY_S": "0",
        "TEST_CWD_FILE": str(cwd_file),
        "TEST_PYTHONPATH_FILE": str(pythonpath_file),
        "TEST_ARGS_FILE": str(args_file),
    }
    result = subprocess.run(
        ["./scripts/run_migrations.sh"],
        cwd=project_root,
        env=env,
        check=True,
        capture_output=True,
        text=True,
    )

    assert "Alembic upgrade head succeeded." in result.stdout
    assert cwd_file.read_text(encoding="utf-8") == "/"
    assert pythonpath_file.read_text(encoding="utf-8") == ""
    assert args_file.read_text(encoding="utf-8").splitlines() == [
        "-c",
        str(project_root / "alembic.ini"),
        "upgrade",
        "head",
    ]




