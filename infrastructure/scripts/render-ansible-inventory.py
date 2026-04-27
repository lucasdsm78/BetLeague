#!/usr/bin/env python3
"""Génère un inventaire Ansible YAML à partir des outputs Terraform.

Usage:
  python3 infrastructure/scripts/render-ansible-inventory.py \
    --terraform-dir infrastructure/terraform \
    --output infrastructure/ansible/inventories/prod/hosts.yml
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


def _load_payload(terraform_dir: Path, input_json: Path | None) -> dict:
    if input_json is not None:
        return json.loads(input_json.read_text())

    result = subprocess.run(
        ["terraform", "output", "-json", "ansible_inventory_host"],
        cwd=terraform_dir,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def _extract_host(payload: dict) -> dict:
    if isinstance(payload, dict) and "ansible_inventory_host" in payload:
        payload = payload["ansible_inventory_host"]

    if isinstance(payload, dict) and "value" in payload:
        payload = payload["value"]

    required = ["group", "hostname", "ansible_host", "ansible_user"]
    missing = [key for key in required if not payload.get(key)]
    if missing:
        raise ValueError(f"Champs Terraform manquants pour l'inventaire Ansible: {', '.join(missing)}")
    return payload


def _to_inventory(host: dict) -> str:
    group = host["group"]
    hostname = host["hostname"]
    hostvars = {k: v for k, v in host.items() if k not in {"group", "hostname"}}

    lines = [
        "all:",
        "  children:",
        f"    {group}:",
        "      hosts:",
        f"        {hostname}:",
    ]
    for key, value in hostvars.items():
        rendered = json.dumps(value)
        lines.append(f"          {key}: {rendered}")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Génère l'inventaire Ansible depuis Terraform")
    parser.add_argument("--terraform-dir", type=Path, default=Path("infrastructure/terraform"))
    parser.add_argument("--input-json", type=Path, default=None)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    payload = _load_payload(terraform_dir=args.terraform_dir, input_json=args.input_json)
    host = _extract_host(payload)
    inventory = _to_inventory(host)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(inventory)
    args.output.chmod(0o600)
    print(f"Inventaire Ansible généré: {args.output}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError as exc:
        print(exc.stderr or str(exc), file=sys.stderr)
        raise SystemExit(exc.returncode) from exc
    except Exception as exc:  # noqa: BLE001
        print(str(exc), file=sys.stderr)
        raise SystemExit(1) from exc


