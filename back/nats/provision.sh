#!/usr/bin/env sh
set -eu

NATS_URL="${NATS_URL:-nats://nats:4222}"
NATS_MONITOR_URL="${NATS_MONITOR_URL:-http://nats:8222}"
STREAM_MAIN="${NATS_STREAM_MAIN:-BETLEAGUE}"
STREAM_DLQ="${NATS_STREAM_DLQ:-BETLEAGUE_DLQ}"
SUBJECTS_MAIN="${NATS_STREAM_SUBJECTS:-betleague.league.> , betleague.ticket.> , betleague.match.>}"
SUBJECT_DLQ="${NATS_DLQ_SUBJECT:-betleague.dlq.>}"

# Optional: creds for system privileges (required by nats CLI for JetStream management)
NATS_CREDS="${NATS_CREDS:-}"

# nats-box provides: nats

echo "[nats_provision] NATS_URL=$NATS_URL"
echo "[nats_provision] NATS_MONITOR_URL=$NATS_MONITOR_URL"
echo "[nats_provision] STREAM_MAIN=$STREAM_MAIN SUBJECTS_MAIN=$SUBJECTS_MAIN"
echo "[nats_provision] STREAM_DLQ=$STREAM_DLQ SUBJECT_DLQ=$SUBJECT_DLQ"
if [ -n "$NATS_CREDS" ]; then
  echo "[nats_provision] NATS_CREDS is set"
else
  echo "[nats_provision] NATS_CREDS is NOT set (may fail if server requires system privileges for management)"
fi

_echo_try() { echo "[nats_provision] try #$1 ..."; }

wait_http() {
  curl -fsS "$NATS_MONITOR_URL/varz" >/dev/null 2>&1
}

echo "[nats_provision] waiting for NATS monitor ..."
for i in $(seq 1 60); do
  _echo_try "$i"
  if wait_http; then
    echo "[nats_provision] NATS monitor reachable"
    break
  fi
  sleep 0.5
  if [ "$i" -eq 60 ]; then
    echo "[nats_provision] ERROR: NATS monitor not reachable at $NATS_MONITOR_URL" >&2
    exit 1
  fi
done

SUBJECTS_MAIN_NORM=$(echo "$SUBJECTS_MAIN" | tr ';' ',' | tr -s ' ')

NATS_USER_ARG="${NATS_USER:-}"
NATS_PASS_ARG="${NATS_PASSWORD:-}"

base_args="--server $NATS_URL"
if [ -n "$NATS_USER_ARG" ]; then
  base_args="$base_args --user $NATS_USER_ARG --password $NATS_PASS_ARG"
fi
if [ -n "$NATS_CREDS" ]; then
  base_args="$base_args --creds $NATS_CREDS"
fi

echo "[nats_provision] ensuring streams via nats CLI ..."

# Create/update main stream
nats $base_args stream add "$STREAM_MAIN" \
  --subjects "$SUBJECTS_MAIN_NORM" \
  --storage file \
  --retention limits \
  --max-msgs -1 \
  --max-bytes -1 \
  --max-age 0 \
  --dupe-window 2m \
  --discard old \
  --replicas 1 \
  --no-deny-delete \
  --no-deny-purge \
  --defaults \
  --force

echo "[nats_provision] main stream OK: $STREAM_MAIN"

# Create/update dlq stream
nats $base_args stream add "$STREAM_DLQ" \
  --subjects "$SUBJECT_DLQ" \
  --storage file \
  --retention limits \
  --max-msgs -1 \
  --max-bytes -1 \
  --max-age 0 \
  --discard old \
  --replicas 1 \
  --no-deny-delete \
  --no-deny-purge \
  --defaults \
  --force

echo "[nats_provision] dlq stream OK: $STREAM_DLQ"

echo "[nats_provision] streams summary:"
nats $base_args stream ls || true
