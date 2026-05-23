#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[neon->ovh] %s\n' "$*" >&2
}

fail() {
  printf '[neon->ovh] ERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

docker_info_value() {
  local format="$1"
  docker info --format "$format" 2>/dev/null | tr -d '[:space:]'
}

SOURCE_DATABASE_URL="${SOURCE_DATABASE_URL:-}"
STACK_NAME="${STACK_NAME:-betleague}"
POSTGRES_SERVICE_NAME="${POSTGRES_SERVICE_NAME:-${STACK_NAME}_postgres}"
TARGET_DATABASE="${TARGET_DATABASE:-betleague}"
TARGET_USER="${TARGET_USER:-betleague_migrations}"
LOCAL_DOCKER_CONTEXT="${LOCAL_DOCKER_CONTEXT:-default}"
LOCAL_POSTGRES_CLIENT_IMAGE="${LOCAL_POSTGRES_CLIENT_IMAGE:-postgres:17}"
REMOTE_POSTGRES_CLIENT_IMAGE="${REMOTE_POSTGRES_CLIENT_IMAGE:-postgres:17}"
DUMP_FILE="${DUMP_FILE:-$PWD/betleague-neon-to-ovh-$(date +%Y%m%d-%H%M%S).dump}"
TARGET_BACKUP_FILE="${TARGET_BACKUP_FILE:-$PWD/betleague-ovh-before-restore-$(date +%Y%m%d-%H%M%S).dump}"
REMOTE_DUMP_PATH="${REMOTE_DUMP_PATH:-/tmp/betleague-neon-to-ovh.dump}"
SKIP_DUMP="${SKIP_DUMP:-0}"
SKIP_TARGET_BACKUP="${SKIP_TARGET_BACKUP:-0}"
KEEP_DUMP="${KEEP_DUMP:-1}"

if [[ "$SKIP_DUMP" != "1" ]]; then
  [[ -n "$SOURCE_DATABASE_URL" ]] || fail "SOURCE_DATABASE_URL is required (use the Neon direct endpoint, not the -pooler host)"
fi

require_cmd docker

docker_server_version="$(docker_info_value '{{.ServerVersion}}')"
[[ -n "$docker_server_version" ]] || fail "Cannot reach a Docker daemon. Run this script on the OVH Swarm manager, or use a remote Docker context / DOCKER_HOST that points to it."

swarm_state="$(docker_info_value '{{.Swarm.LocalNodeState}}')"
[[ "$swarm_state" == "active" ]] || fail "Docker Swarm is not active on the current Docker daemon (state=${swarm_state:-unknown}). Run this script on the Swarm manager hosting BetLeague, or target that daemon explicitly."

service_replicas="$(docker service inspect --format '{{if .Spec.Name}}{{.Spec.Name}} {{end}}{{if .ServiceStatus}}{{.ServiceStatus.RunningTasks}}/{{.Spec.Mode.Replicated.Replicas}}{{end}}' "$POSTGRES_SERVICE_NAME" 2>/dev/null || true)"
[[ -n "$service_replicas" ]] || fail "Swarm service ${POSTGRES_SERVICE_NAME} does not exist on the current Docker daemon. You are probably running the script on the wrong machine/context. Expected: the OVH Swarm manager."

container_id="$({ docker ps --filter "label=com.docker.swarm.service.name=${POSTGRES_SERVICE_NAME}" --format '{{.ID}}' | head -n1; } | tr -d '[:space:]')"
[[ -n "$container_id" ]] || fail "Could not find a running container for service ${POSTGRES_SERVICE_NAME}. Check 'docker service ps ${POSTGRES_SERVICE_NAME}' and ensure the service is converged before retrying."

docker exec "$container_id" test -r /run/secrets/postgres_migrations_password \
  || fail "postgres_migrations_password is not readable inside ${POSTGRES_SERVICE_NAME}"

target_password="$(docker exec "$container_id" cat /run/secrets/postgres_migrations_password | tr -d '\r\n')"
[[ -n "$target_password" ]] || fail "postgres_migrations_password is empty inside ${POSTGRES_SERVICE_NAME}"

if [[ "$SKIP_DUMP" != "1" ]]; then
  log "Creating custom-format dump from Neon into ${DUMP_FILE} using ${LOCAL_POSTGRES_CLIENT_IMAGE} on docker context ${LOCAL_DOCKER_CONTEXT}"
  docker --context "$LOCAL_DOCKER_CONTEXT" run --rm \
    -e SOURCE_DATABASE_URL="$SOURCE_DATABASE_URL" \
    "$LOCAL_POSTGRES_CLIENT_IMAGE" \
    sh -lc '
      set -eu
      pg_dump \
        --format=custom \
        --no-owner \
        --no-privileges \
        --schema=public \
        "$SOURCE_DATABASE_URL"
    ' > "$DUMP_FILE"
else
  log "Skipping dump creation because SKIP_DUMP=1"
fi

[[ -s "$DUMP_FILE" ]] || fail "Dump file is missing or empty: ${DUMP_FILE}"

if [[ "$SKIP_TARGET_BACKUP" != "1" ]]; then
  log "Creating safety backup of target PostgreSQL into ${TARGET_BACKUP_FILE} using ${REMOTE_POSTGRES_CLIENT_IMAGE}"
  docker run --rm \
    --network "container:$container_id" \
    -e PGPASSWORD="$target_password" \
    -e TARGET_DATABASE="$TARGET_DATABASE" \
    -e TARGET_USER="$TARGET_USER" \
    "$REMOTE_POSTGRES_CLIENT_IMAGE" \
    sh -lc '
      set -eu
      pg_dump \
        --format=custom \
        --no-owner \
        --no-privileges \
        --schema=public \
        --host 127.0.0.1 \
        --port 5432 \
        --username "$TARGET_USER" \
        --dbname "$TARGET_DATABASE"
    ' > "$TARGET_BACKUP_FILE"

  [[ -s "$TARGET_BACKUP_FILE" ]] || fail "Target backup file is missing or empty: ${TARGET_BACKUP_FILE}"
else
  log "Skipping target safety backup because SKIP_TARGET_BACKUP=1"
fi

log "Restoring archive into ${TARGET_DATABASE} as ${TARGET_USER} using ${REMOTE_POSTGRES_CLIENT_IMAGE}"
cat "$DUMP_FILE" \
  | docker run --rm -i \
      --network "container:$container_id" \
      -e PGPASSWORD="$target_password" \
      -e TARGET_DATABASE="$TARGET_DATABASE" \
      -e TARGET_USER="$TARGET_USER" \
      "$REMOTE_POSTGRES_CLIENT_IMAGE" \
      sh -lc '
        set -eu
        archive_path="/tmp/betleague-restore.dump"
        cat > "$archive_path"

        pg_restore \
          --clean \
          --if-exists \
          --no-owner \
          --no-privileges \
          --schema=public \
          --file=- \
          "$archive_path" \
        | sed "/^SET transaction_timeout = /d" \
        | psql \
            --username "$TARGET_USER" \
            --host 127.0.0.1 \
            --port 5432 \
            --dbname "$TARGET_DATABASE"

        rm -f "$archive_path"

        vacuumdb --analyze-in-stages --username "$TARGET_USER" --host 127.0.0.1 --port 5432 --dbname "$TARGET_DATABASE"

        if psql --username "$TARGET_USER" --host 127.0.0.1 --port 5432 --dbname "$TARGET_DATABASE" -tAc "SELECT to_regclass('\''public.alembic_version'\'') IS NOT NULL" | grep -qx t; then
          psql --username "$TARGET_USER" --host 127.0.0.1 --port 5432 --dbname "$TARGET_DATABASE" -c "TABLE alembic_version;"
        else
          echo "[neon->ovh] WARNING: public.alembic_version is missing after restore" >&2
        fi
      '

if [[ "$KEEP_DUMP" != "1" ]]; then
  log "Removing local dump archive ${DUMP_FILE}"
  rm -f "$DUMP_FILE"
fi

log "Migration completed successfully"
log "Next step: point backend.env and migrations.env to the internal PostgreSQL service and redeploy if not already active"








