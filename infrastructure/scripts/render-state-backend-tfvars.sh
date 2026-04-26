#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
STATE_IDENTITIES_DIR="${1:-$REPO_ROOT/infrastructure/state-identities}"
OUTPUT_PATH="${2:-}"

TMP_JSON="$(mktemp)"
trap 'rm -f "$TMP_JSON"' EXIT

(
  cd "$STATE_IDENTITIES_DIR"
  terraform output -json > "$TMP_JSON"
)

RENDERED="$(python3 - "$TMP_JSON" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text())

def value(name):
    return payload[name]["value"]

lines = [
    f'access_key_id_dev      = "{value("state_dev_s3_access_key_id")}"',
    f'secret_access_key_dev  = "{value("state_dev_s3_secret_access_key")}"',
    f'access_key_id_prod     = "{value("state_prod_s3_access_key_id")}"',
    f'secret_access_key_prod = "{value("state_prod_s3_secret_access_key")}"',
    "",
    f'bucket_name_dev  = "{value("state_backend_bucket_names")["dev"]}"',
    f'bucket_name_prod = "{value("state_backend_bucket_names")["prod"]}"',
]
print("\n".join(lines))
PY
)"

if [[ -n "$OUTPUT_PATH" ]]; then
  printf '%s\n' "$RENDERED" > "$OUTPUT_PATH"
  printf 'Fichier généré : %s\n' "$OUTPUT_PATH"
else
  printf '%s\n' "$RENDERED"
fi

