from pathlib import Path

from infrastructure.env_files import load_env_files, parse_env_file_content


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

