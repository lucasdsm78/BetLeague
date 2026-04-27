#!/usr/bin/env python3
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"
TEMPLATE_PATH = ROOT / "templates" / "edge.conf.template"
OUTPUT_DIR = ROOT / "generated"
OUTPUT_PATH = OUTPUT_DIR / "edge.conf"

REQUIRED_KEYS = ("APP_DOMAIN", "API_DOMAIN")


def load_env(path: Path) -> dict[str, str]:
    payload: dict[str, str] = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        payload[key.strip()] = value.strip()
    return payload


def main() -> int:
    if not ENV_PATH.exists():
        raise SystemExit(f"Fichier manquant: {ENV_PATH}. Copie d'abord .env.example vers .env")

    values = load_env(ENV_PATH)
    missing = [key for key in REQUIRED_KEYS if not values.get(key)]
    if missing:
        raise SystemExit(f"Variables manquantes dans {ENV_PATH}: {', '.join(missing)}")

    template = TEMPLATE_PATH.read_text()
    rendered = template
    for key, value in values.items():
        rendered = rendered.replace(f"${{{key}}}", value)

    unresolved = [token for token in REQUIRED_KEYS if f"${{{token}}}" in rendered]
    if unresolved:
        raise SystemExit(f"Substitutions non résolues: {', '.join(unresolved)}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(rendered)
    print(f"Config générée: {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

