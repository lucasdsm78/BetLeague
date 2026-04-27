#!/usr/bin/env python3
"""Génère un inventaire Ansible YAML.

Sources supportées :
- outputs Terraform (mode historique)
- payload JSON déjà exporté
- cible SSH fournie explicitement, pour un déploiement sans Terraform

Exemples :
  python3 infrastructure/scripts/render-ansible-inventory.py \
    --terraform-dir infrastructure/terraform \
    --output infrastructure/ansible/inventories/prod/hosts.yml

  python3 infrastructure/scripts/render-ansible-inventory.py \
    --ansible-host 203.0.113.10 \
    --ansible-user deploy \
    --hostname betleague-prod \
    --environment-name prod \
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


def _build_direct_payload(args: argparse.Namespace) -> dict:
    if not args.ansible_host or not args.ansible_user:
        missing = [
            name
            for name, value in {
                "--ansible-host": args.ansible_host,
                "--ansible-user": args.ansible_user,
            }.items()
            if not value
        ]
        raise ValueError(
            "Le mode sans Terraform requiert explicitement : " + ", ".join(missing)
        )

    hostname = args.hostname or args.ansible_host.replace(".", "-")
    payload = {
        "group": args.group,
        "hostname": hostname,
        "ansible_host": args.ansible_host,
        "ansible_user": args.ansible_user,
    }

    optional_values = {
        "betleague_instance_name": args.instance_name or hostname,
        "betleague_environment": args.environment_name,
        "betleague_compose_root": args.compose_root,
        "betleague_vps_service_name": args.vps_service_name,
        "betleague_vps_plan_code": args.vps_plan_code,
    }
    payload.update({key: value for key, value in optional_values.items() if value})
    return payload


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
    parser.add_argument("--group", default="betleague_vps3")
    parser.add_argument("--hostname", default=None)
    parser.add_argument("--ansible-host", dest="ansible_host", default=None)
    parser.add_argument("--ansible-user", dest="ansible_user", default=None)
    parser.add_argument("--instance-name", default=None)
    parser.add_argument("--environment-name", default=None)
    parser.add_argument("--compose-root", default=None)
    parser.add_argument("--vps-service-name", default=None)
    parser.add_argument("--vps-plan-code", default=None)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    if args.ansible_host or args.ansible_user:
        payload = _build_direct_payload(args)
    else:
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



