#!/bin/zsh
set -euo pipefail

PYTHON3="${PYTHON3:-/Library/Frameworks/Python.framework/Versions/3.13/bin/python3}"
API_URL="${API_URL:-http://localhost:8001/api}"
ENV_FILE="${ENV_FILE:-back/.env}"

read_env_value() {
  local key="$1"
  local file_path="${2:-$ENV_FILE}"

  [[ -f "$file_path" ]] || return 1

  local raw_value
  raw_value="$(awk -F= -v k="$key" '$1 == k {print substr($0, index($0, "=") + 1); exit}' "$file_path")"
  [[ -n "$raw_value" ]] || return 1

  raw_value="${raw_value#\"}"
  raw_value="${raw_value%\"}"
  raw_value="${raw_value#\'}"
  raw_value="${raw_value%\'}"
  printf '%s' "$raw_value"
}

SCHEDULER_INTERNAL_TOKEN="${SCHEDULER_INTERNAL_TOKEN:-$(read_env_value SCHEDULER_INTERNAL_TOKEN 2>/dev/null || true)}"
SCHEDULER_ADMIN_JWT="${SCHEDULER_ADMIN_JWT:-}"

json_get() {
  local path="$1"
  "$PYTHON3" -c '
import json, sys
data = json.load(sys.stdin)
cur = data
for part in sys.argv[1].split("."):
    cur = cur[int(part)] if part.isdigit() else cur[part]
print(cur)
' "$path"
}

pretty_json() {
  "$PYTHON3" -m json.tool
}

curl_json() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  local token="${4:-}"
  local -a headers
  headers=(-H "Content-Type: application/json")
  if [[ -n "$token" ]]; then
    headers+=(-H "X-Authentication: Bearer $token")
  fi

  if [[ -n "$body" ]]; then
    curl -fsS -X "$method" "$url" "${headers[@]}" -d "$body"
  else
    curl -fsS -X "$method" "$url" "${headers[@]}"
  fi
}

curl_scheduler_json() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  local -a headers
  headers=(-H "Content-Type: application/json")

  if [[ -n "$SCHEDULER_INTERNAL_TOKEN" ]]; then
    headers+=(-H "X-Internal-Token: $SCHEDULER_INTERNAL_TOKEN")
  elif [[ -n "$SCHEDULER_ADMIN_JWT" ]]; then
    headers+=(-H "X-Authentication: Bearer $SCHEDULER_ADMIN_JWT")
  else
    echo "❌ Scheduler protégé: définis SCHEDULER_INTERNAL_TOKEN (recommandé) ou SCHEDULER_ADMIN_JWT"
    echo "   - variable d'environnement shell"
    echo "   - ou SCHEDULER_INTERNAL_TOKEN dans $ENV_FILE"
    return 1
  fi

  if [[ -n "$body" ]]; then
    curl -fsS -X "$method" "$url" "${headers[@]}" -d "$body"
  else
    curl -fsS -X "$method" "$url" "${headers[@]}"
  fi
}

psqlq() {
  docker compose exec -T db psql -U postgres -d betleague -Atqc "$1"
}

psqlshow() {
  docker compose exec -T db psql -U postgres -d betleague -c "$1"
}

wait_backend() {
  echo "⏳ Attente du backend sur http://localhost:8001/openapi.json ..."
  until curl -fsS "http://localhost:8001/openapi.json" >/dev/null 2>&1; do
    sleep 2
  done
  echo "✅ Backend prêt"
}

wait_stage_completed() {
  local stage_id="$1"
  local ok="0"

  for _ in {1..30}; do
    ok="$(psqlq "SELECT CASE WHEN is_completed THEN 1 ELSE 0 END FROM tournament_stage WHERE id = ${stage_id};")"
    if [[ "$ok" == "1" ]]; then
      return 0
    fi
    sleep 1
  done

  echo "❌ Le stage ${stage_id} n'a pas été marqué completed dans le délai attendu"
  return 1
}

seed_scores_for_stage_matches() {
  local tournament_id="$1"
  local stage_id="$2"

  local match_count
  match_count="$(psqlq "SELECT COUNT(*) FROM tournament_match WHERE tournament_id = ${tournament_id} AND stage_id = ${stage_id};")"

  if [[ "$match_count" == "0" ]]; then
    echo "ℹ️ Aucun match à scorer pour le stage ${stage_id}"
    return 0
  fi

  echo "🎯 Injection de scores BTL sur les joueurs du stage ${stage_id}"
  psqlshow "
    SELECT
      tm.id AS match_id,
      tm.type,
      tm.player1_id,
      p1.user_id AS player1_user_id,
      tp1.nb_btl AS player1_btl,
      tm.player2_id,
      p2.user_id AS player2_user_id,
      tp2.nb_btl AS player2_btl
    FROM tournament_match tm
    LEFT JOIN tournament_player tp1 ON tp1.id = tm.player1_id
    LEFT JOIN tournament_player tp2 ON tp2.id = tm.player2_id
    LEFT JOIN tournament_player p1 ON p1.id = tm.player1_id
    LEFT JOIN tournament_player p2 ON p2.id = tm.player2_id
    WHERE tm.tournament_id = ${tournament_id}
      AND tm.stage_id = ${stage_id}
    ORDER BY tm.id;
  "

  psqlq "
    WITH current_matches AS (
      SELECT player1_id, player2_id
      FROM tournament_match
      WHERE tournament_id = ${tournament_id}
        AND stage_id = ${stage_id}
    )
    UPDATE tournament_player tp
    SET
      nb_btl = CASE
        WHEN tp.id IN (SELECT player1_id FROM current_matches) THEN 10
        WHEN tp.id IN (SELECT player2_id FROM current_matches) THEN 20
        ELSE tp.nb_btl
      END,
      updated_at = (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint
    WHERE tp.tournament_id = ${tournament_id}
      AND tp.id IN (
        SELECT player1_id FROM current_matches
        UNION
        SELECT player2_id FROM current_matches
      );
  "

  psqlshow "
    SELECT id, user_id, stage, nb_btl, is_eliminated
    FROM tournament_player
    WHERE tournament_id = ${tournament_id}
    ORDER BY id;
  "
}

run_scheduler_cycle() {
  local tournament_id="$1"

  local stage_row
  stage_row="$(psqlq "
    SELECT id || '|' || type
    FROM tournament_stage
    WHERE tournament_id = ${tournament_id}
      AND is_active = TRUE
    ORDER BY start_date ASC
    LIMIT 1;
  ")"

  if [[ -z "$stage_row" ]]; then
    echo "❌ Aucun stage actif trouvé pour le tournoi ${tournament_id}"
    return 1
  fi

  local stage_id="${stage_row%%|*}"
  local stage_type="${stage_row##*|}"

  echo ""
  echo "============================================================"
  echo "🚀 Cycle scheduler sur le stage actif : ${stage_type} (id=${stage_id})"
  echo "============================================================"

  echo "⏰ Forçage du end_date du stage dans le passé"
  psqlq "
    UPDATE tournament_stage
    SET end_date = (EXTRACT(EPOCH FROM NOW() - INTERVAL '1 minute') * 1000)::bigint
    WHERE id = ${stage_id};
  "

  seed_scores_for_stage_matches "${tournament_id}" "${stage_id}"

  echo "📡 Déclenchement du scheduler via POST /api/scheduler/run"
  curl_scheduler_json POST "${API_URL}/scheduler/run" | pretty_json

  echo "⏳ Attente de la completion du stage ${stage_id}"
  wait_stage_completed "${stage_id}"

  echo "📋 État tournoi/stages/matchs après exécution"
  psqlshow "
    SELECT id, name, status, current_players, winner_id, entry_fee, prize_pool
    FROM tournament
    WHERE id = ${tournament_id};
  "

  psqlshow "
    SELECT
      id,
      type,
      is_active,
      is_completed,
      to_timestamp(start_date / 1000.0) AT TIME ZONE 'UTC' AS start_date_utc,
      to_timestamp(end_date / 1000.0) AT TIME ZONE 'UTC' AS end_date_utc
    FROM tournament_stage
    WHERE tournament_id = ${tournament_id}
    ORDER BY start_date ASC;
  "

  psqlshow "
    SELECT
      id,
      type,
      stage_id,
      player1_id,
      player2_id,
      winner_id,
      loser_id
    FROM tournament_match
    WHERE tournament_id = ${tournament_id}
    ORDER BY id ASC;
  "

  psqlshow "
    SELECT id, user_id, stage, nb_btl, is_eliminated
    FROM tournament_player
    WHERE tournament_id = ${tournament_id}
    ORDER BY id ASC;
  "
}

echo "🚀 Démarrage des services nécessaires"
docker compose up -d db redis backend celery_worker celery_beat

wait_backend

SUFFIX="$(date +%s)"
PASSWORD="Password123!"

OWNER_EMAIL="tournoi.owner.${SUFFIX}@test.local"
P2_EMAIL="tournoi.player2.${SUFFIX}@test.local"
P3_EMAIL="tournoi.player3.${SUFFIX}@test.local"
P4_EMAIL="tournoi.player4.${SUFFIX}@test.local"

echo ""
echo "👤 Création des 4 utilisateurs de test"
OWNER_REGISTER="$(curl_json POST "${API_URL}/auth/register" "{\"pseudo\":\"owner_${SUFFIX}\",\"email\":\"${OWNER_EMAIL}\",\"password\":\"${PASSWORD}\"}")"
P2_REGISTER="$(curl_json POST "${API_URL}/auth/register" "{\"pseudo\":\"player2_${SUFFIX}\",\"email\":\"${P2_EMAIL}\",\"password\":\"${PASSWORD}\"}")"
P3_REGISTER="$(curl_json POST "${API_URL}/auth/register" "{\"pseudo\":\"player3_${SUFFIX}\",\"email\":\"${P3_EMAIL}\",\"password\":\"${PASSWORD}\"}")"
P4_REGISTER="$(curl_json POST "${API_URL}/auth/register" "{\"pseudo\":\"player4_${SUFFIX}\",\"email\":\"${P4_EMAIL}\",\"password\":\"${PASSWORD}\"}")"

OWNER_TOKEN="$(printf '%s' "$OWNER_REGISTER" | json_get token_auth)"
P2_TOKEN="$(printf '%s' "$P2_REGISTER" | json_get token_auth)"
P3_TOKEN="$(printf '%s' "$P3_REGISTER" | json_get token_auth)"
P4_TOKEN="$(printf '%s' "$P4_REGISTER" | json_get token_auth)"

echo "✅ Utilisateurs créés"

echo ""
echo "🏆 Création du tournoi"
TOURNAMENT_NAME="Manual Scheduler E2E ${SUFFIX}"
CREATE_RESPONSE="$(curl_json POST "${API_URL}/tournament/create" "{\"name\":\"${TOURNAMENT_NAME}\",\"is_private\":false,\"max_players\":16}" "$OWNER_TOKEN")"
printf '%s' "$CREATE_RESPONSE" | pretty_json

TOURNAMENT_ID="$(printf '%s' "$CREATE_RESPONSE" | json_get tournament_id)"
echo "✅ Tournament ID = ${TOURNAMENT_ID}"

echo ""
echo "➕ Inscriptions des 3 autres joueurs"
curl_json POST "${API_URL}/tournament/${TOURNAMENT_ID}/join" "" "$P2_TOKEN" | pretty_json
curl_json POST "${API_URL}/tournament/${TOURNAMENT_ID}/join" "" "$P3_TOKEN" | pretty_json
curl_json POST "${API_URL}/tournament/${TOURNAMENT_ID}/join" "" "$P4_TOKEN" | pretty_json

echo ""
echo "▶️ Démarrage du tournoi par le créateur"
curl_json POST "${API_URL}/tournament/${TOURNAMENT_ID}/start" "" "$OWNER_TOKEN" | pretty_json

echo ""
echo "📋 Lecture des stages via API"
curl_json GET "${API_URL}/tournament/${TOURNAMENT_ID}/stages" "" "$OWNER_TOKEN" | pretty_json

echo ""
echo "📋 Snapshot SQL initial"
psqlshow "
  SELECT id, name, status, current_players, winner_id, entry_fee, prize_pool
  FROM tournament
  WHERE id = ${TOURNAMENT_ID};
"

psqlshow "
  SELECT
    id,
    type,
    is_active,
    is_completed,
    to_timestamp(start_date / 1000.0) AT TIME ZONE 'UTC' AS start_date_utc,
    to_timestamp(end_date / 1000.0) AT TIME ZONE 'UTC' AS end_date_utc
  FROM tournament_stage
  WHERE tournament_id = ${TOURNAMENT_ID}
  ORDER BY start_date ASC;
"

psqlshow "
  SELECT
    id,
    type,
    stage_id,
    player1_id,
    player2_id,
    winner_id,
    loser_id
  FROM tournament_match
  WHERE tournament_id = ${TOURNAMENT_ID}
  ORDER BY id ASC;
"

psqlshow "
  SELECT id, user_id, stage, nb_btl, is_eliminated
  FROM tournament_player
  WHERE tournament_id = ${TOURNAMENT_ID}
  ORDER BY id ASC;
"

USER_WALLETS_BEFORE="$(psqlq "
  SELECT id || ':' || nb_btl
  FROM \"user\"
  WHERE id IN (
    SELECT user_id
    FROM tournament_player
    WHERE tournament_id = ${TOURNAMENT_ID}
  )
  ORDER BY id ASC;
")"

echo ""
echo "💰 Wallets avant scheduler final:"
printf '%s\n' "$USER_WALLETS_BEFORE"

echo ""
echo "🔁 Exécution successive du scheduler jusqu'à completion"
for _ in {1..5}; do
  STATUS_NOW="$(psqlq "SELECT status FROM tournament WHERE id = ${TOURNAMENT_ID};")"
  if [[ "$STATUS_NOW" == "completed" ]]; then
    break
  fi
  run_scheduler_cycle "${TOURNAMENT_ID}"
done

FINAL_STATUS="$(psqlq "SELECT status FROM tournament WHERE id = ${TOURNAMENT_ID};")"
if [[ "$FINAL_STATUS" != "completed" ]]; then
  echo "❌ Le tournoi n'est pas passé à completed"
  exit 1
fi

WINNER_ID="$(psqlq "SELECT winner_id FROM tournament WHERE id = ${TOURNAMENT_ID};")"
if [[ -z "$WINNER_ID" || "$WINNER_ID" == "" ]]; then
  echo "❌ winner_id absent"
  exit 1
fi

WINNER_BEFORE="$(printf '%s\n' "$USER_WALLETS_BEFORE" | awk -F: -v id="$WINNER_ID" '$1 == id { print $2 }')"
WINNER_AFTER="$(psqlq "SELECT nb_btl FROM \"user\" WHERE id = ${WINNER_ID};")"

if [[ -z "$WINNER_BEFORE" ]]; then
  echo "❌ Impossible de retrouver le wallet initial du vainqueur"
  exit 1
fi

DELTA="$("$PYTHON3" - <<PY
from decimal import Decimal
before = Decimal("${WINNER_BEFORE}")
after = Decimal("${WINNER_AFTER}")
print(after - before)
PY
)"

echo ""
echo "🏁 Vérification finale"
psqlshow "
  SELECT id, name, status, winner_id
  FROM tournament
  WHERE id = ${TOURNAMENT_ID};
"

psqlshow "
  SELECT id, pseudo, nb_btl
  FROM \"user\"
  WHERE id = ${WINNER_ID};
"

echo "Vainqueur user_id=${WINNER_ID}"
echo "Wallet avant=${WINNER_BEFORE}"
echo "Wallet après=${WINNER_AFTER}"
echo "Delta=${DELTA}"

"$PYTHON3" - <<PY
from decimal import Decimal
delta = Decimal("${DELTA}")
assert delta == Decimal("20"), f"Le crédit attendu est 20, obtenu={delta}"
print("✅ Crédit final de 20 BTL validé")
PY

echo ""
echo "♻️ Vérification idempotence : rerun scheduler après completion"
curl_scheduler_json POST "${API_URL}/scheduler/run" | pretty_json
sleep 3

WINNER_AFTER_RERUN="$(psqlq "SELECT nb_btl FROM \"user\" WHERE id = ${WINNER_ID};")"
"$PYTHON3" - <<PY
from decimal import Decimal
after1 = Decimal("${WINNER_AFTER}")
after2 = Decimal("${WINNER_AFTER_RERUN}")
assert after1 == after2, f"Le wallet a changé après rerun: {after1} -> {after2}"
print("✅ Idempotence validée : aucun second crédit")
PY

echo ""
echo "🎉 TEST E2E DU SCHEDULER TOURNOI VALIDÉ"
echo "Tournament ID: ${TOURNAMENT_ID}"
echo "Winner ID: ${WINNER_ID}"
echo "Winner wallet final: ${WINNER_AFTER_RERUN}"


