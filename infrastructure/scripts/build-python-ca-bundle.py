#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
from pathlib import Path

import certifi


def main() -> int:
    if len(sys.argv) != 2:
        print(
            "Usage: build-python-ca-bundle.py <output-pem-path>",
            file=sys.stderr,
        )
        return 2

    output_path = Path(sys.argv[1]).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    bundle = Path(certifi.where()).read_text()
    extra_pem = os.environ.get("BETLEAGUE_EXTRA_CA_CERT_PEM", "").strip()
    extra_pem_path = os.environ.get("BETLEAGUE_EXTRA_CA_CERT_PATH", "").strip()

    parts = [bundle.rstrip()]

    if extra_pem:
        parts.append(extra_pem)

    if extra_pem_path:
        parts.append(Path(extra_pem_path).expanduser().read_text().strip())

    output_path.write_text("\n".join(part for part in parts if part) + "\n")
    output_path.chmod(0o600)
    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

