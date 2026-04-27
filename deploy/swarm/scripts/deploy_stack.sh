#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
STACK_FILE="$ROOT_DIR/stack.prod.yml"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Fichier manquant: $ENV_FILE" >&2
  echo "Copie $ROOT_DIR/.env.example vers .env puis renseigne les valeurs." >&2
  exit 1
fi

export $(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$ENV_FILE" | xargs)
: "${STACK_NAME:?STACK_NAME must be set in .env}"

"$SCRIPT_DIR/preflight.sh"

cd "$ROOT_DIR"
docker stack deploy --with-registry-auth -c "$STACK_FILE" "$STACK_NAME"

echo "Stack déployée: $STACK_NAME"


