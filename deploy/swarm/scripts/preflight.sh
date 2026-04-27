#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

required_files=(
  "$ENV_FILE"
  "$ROOT_DIR/secrets/backend.env"
  "$ROOT_DIR/secrets/redis_password.txt"
  "$ROOT_DIR/secrets/nats_user.txt"
  "$ROOT_DIR/secrets/nats_password.txt"
  "$ROOT_DIR/secrets/tls.crt.pem"
  "$ROOT_DIR/secrets/tls.key.pem"
  "$ROOT_DIR/secrets/nats-ca-cert.pem"
  "$ROOT_DIR/secrets/nats-server-cert.pem"
  "$ROOT_DIR/secrets/nats-server-key.pem"
  "$ROOT_DIR/secrets/nats-client-cert.pem"
  "$ROOT_DIR/secrets/nats-client-key.pem"
)

for file in "${required_files[@]}"; do
  [[ -f "$file" ]] || { echo "Fichier requis manquant: $file" >&2; exit 1; }
done

command -v docker >/dev/null 2>&1 || { echo "docker est requis" >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo "docker doit être accessible" >&2; exit 1; }

docker info --format '{{.Swarm.LocalNodeState}}' | grep -qx 'active' || {
  echo "Docker Swarm n'est pas actif sur cet hôte." >&2
  exit 1
}

docker node inspect self --format '{{ index .Spec.Labels "betleague.role" }}' 2>/dev/null | grep -qx 'manager' || {
  echo "Le noeud manager doit être labellisé betleague.role=manager" >&2
  exit 1
}

python3 "$SCRIPT_DIR/render_stack_assets.py" >/dev/null

echo "Preflight OK"

