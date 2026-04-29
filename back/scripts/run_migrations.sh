#!/bin/sh
set -eu

RETRIES="${ALEMBIC_UPGRADE_MAX_RETRIES:-30}"
DELAY="${ALEMBIC_UPGRADE_RETRY_DELAY_S:-2}"
ATTEMPT=1
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
APP_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
ALEMBIC_CONFIG="$APP_ROOT/alembic.ini"

while [ "$ATTEMPT" -le "$RETRIES" ]; do
  # Le dossier /app/alembic contient les scripts de migration ; s'il est importable
  # via le répertoire courant ou PYTHONPATH, il masque le vrai paquet site-packages
  # `alembic` et casse l'entrée CLI (`from alembic.config import main`).
  if (
    unset PYTHONPATH
    cd /
    alembic -c "$ALEMBIC_CONFIG" upgrade head
  ); then
    echo "Alembic upgrade head succeeded."
    exit 0
  fi

  echo "Alembic upgrade failed (attempt ${ATTEMPT}/${RETRIES}). Retrying in ${DELAY}s..." >&2
  ATTEMPT=$((ATTEMPT + 1))
  sleep "$DELAY"
done

echo "Alembic upgrade head failed after ${RETRIES} attempts." >&2
exit 1

