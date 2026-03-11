#!/bin/sh
set -eu

RETRIES="${ALEMBIC_UPGRADE_MAX_RETRIES:-30}"
DELAY="${ALEMBIC_UPGRADE_RETRY_DELAY_S:-2}"
ATTEMPT=1

while [ "$ATTEMPT" -le "$RETRIES" ]; do
  if alembic -c alembic.ini upgrade head; then
    echo "Alembic upgrade head succeeded."
    exit 0
  fi

  echo "Alembic upgrade failed (attempt ${ATTEMPT}/${RETRIES}). Retrying in ${DELAY}s..." >&2
  ATTEMPT=$((ATTEMPT + 1))
  sleep "$DELAY"
done

echo "Alembic upgrade head failed after ${RETRIES} attempts." >&2
exit 1

