-- Audit PostgreSQL index usage for BetLeague core tables
-- Usage:
--   cat back/scripts/audit_index_usage.sql | docker compose exec -T db psql -U postgres -d betleague -P pager=off

\echo '=== 1) Stats context ==='
SELECT
  current_database() AS db,
  now() AS collected_at,
  (SELECT stats_reset FROM pg_stat_database WHERE datname = current_database()) AS db_stats_reset,
  EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') AS has_pg_stat_statements;

\echo '=== 2) Index inventory + usage ==='
WITH idx AS (
  SELECT schemaname, tablename, indexname, indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename IN (
      'ticket','notification','invitation','league','leagues_players','tournament',
      'tournament_stage','tournament_player','tournament_match','outbox_message',
      'match','user','purchase','tournament_subscription','match_choices'
    )
),
cons AS (
  SELECT conrelid::regclass::text AS tablename, conname AS indexname, contype
  FROM pg_constraint
  WHERE conindid <> 0
),
stats AS (
  SELECT
    s.relname AS tablename,
    i.relname AS indexname,
    COALESCE(psui.idx_scan,0) AS idx_scan,
    COALESCE(psui.idx_tup_read,0) AS idx_tup_read,
    COALESCE(psui.idx_tup_fetch,0) AS idx_tup_fetch,
    COALESCE(psuti.idx_blks_read,0) AS idx_blks_read,
    COALESCE(psuti.idx_blks_hit,0) AS idx_blks_hit,
    pg_relation_size(i.oid) AS bytes
  FROM pg_class s
  JOIN pg_index x ON s.oid = x.indrelid
  JOIN pg_class i ON i.oid = x.indexrelid
  LEFT JOIN pg_stat_user_indexes psui ON psui.indexrelid = i.oid
  LEFT JOIN pg_statio_user_indexes psuti ON psuti.indexrelid = i.oid
  WHERE s.relname IN (
    'ticket','notification','invitation','league','leagues_players','tournament',
    'tournament_stage','tournament_player','tournament_match','outbox_message',
    'match','user','purchase','tournament_subscription','match_choices'
  )
)
SELECT
  idx.tablename,
  idx.indexname,
  COALESCE(cons.contype,'-') AS constraint_type,
  stats.idx_scan,
  stats.idx_tup_read,
  stats.idx_tup_fetch,
  stats.idx_blks_read,
  stats.idx_blks_hit,
  pg_size_pretty(stats.bytes) AS index_size,
  idx.indexdef
FROM idx
LEFT JOIN stats ON stats.tablename = idx.tablename AND stats.indexname = idx.indexname
LEFT JOIN cons ON cons.tablename = idx.tablename AND cons.indexname = idx.indexname
ORDER BY idx.tablename, stats.idx_scan DESC NULLS LAST, idx.indexname;

\echo '=== 3) Table access stats ==='
SELECT
  relname AS table_name,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch,
  n_live_tup,
  n_dead_tup,
  pg_size_pretty(pg_relation_size(relid)) AS table_size
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname IN (
    'ticket','notification','invitation','league','leagues_players','tournament',
    'tournament_stage','tournament_player','tournament_match','outbox_message',
    'match','user','purchase','tournament_subscription','match_choices'
  )
ORDER BY pg_relation_size(relid) DESC, relname;

\echo '=== 4) Exact structural duplicate indexes ==='
WITH idx AS (
  SELECT
    t.relname AS table_name,
    i.relname AS index_name,
    ix.indisunique,
    ix.indisprimary,
    pg_get_expr(ix.indpred, t.oid) AS predicate,
    array_agg(a.attname ORDER BY arr.ord) AS cols
  FROM pg_index ix
  JOIN pg_class i ON i.oid = ix.indexrelid
  JOIN pg_class t ON t.oid = ix.indrelid
  JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS arr(attnum, ord) ON true
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = arr.attnum
  WHERE t.relname IN (
    'ticket','notification','invitation','league','leagues_players','tournament',
    'tournament_stage','tournament_player','tournament_match','outbox_message',
    'match','user','purchase','tournament_subscription','match_choices'
  )
  GROUP BY t.relname, i.relname, ix.indisunique, ix.indisprimary, predicate
),
grouped AS (
  SELECT
    table_name,
    cols,
    COALESCE(predicate,'') AS predicate,
    string_agg(
      index_name || CASE WHEN indisprimary THEN '[pk]' WHEN indisunique THEN '[uniq]' ELSE '' END,
      ', ' ORDER BY index_name
    ) AS indexes,
    count(*) AS cnt
  FROM idx
  GROUP BY table_name, cols, COALESCE(predicate,'')
  HAVING count(*) > 1
)
SELECT table_name, cols, predicate, indexes, cnt
FROM grouped
ORDER BY table_name, cols;

\echo '=== 5) Foreign keys covered by leading index prefix ==='
WITH fk AS (
  SELECT
    conrelid,
    conname,
    conrelid::regclass::text AS table_name,
    array_agg(att.attname ORDER BY ord.n) AS fk_cols
  FROM pg_constraint c
  JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS ord(attnum, n) ON true
  JOIN pg_attribute att ON att.attrelid = c.conrelid AND att.attnum = ord.attnum
  WHERE c.contype = 'f'
    AND c.conrelid::regclass::text IN (
      'ticket','notification','invitation','league','leagues_players','tournament',
      'tournament_stage','tournament_player','tournament_match','outbox_message',
      'match','user','purchase','tournament_subscription','match_choices'
    )
  GROUP BY conrelid, conname
),
idx AS (
  SELECT
    t.oid AS relid,
    i.relname AS index_name,
    array_agg(a.attname ORDER BY ord.n) AS idx_cols
  FROM pg_index x
  JOIN pg_class t ON t.oid = x.indrelid
  JOIN pg_class i ON i.oid = x.indexrelid
  JOIN LATERAL unnest(x.indkey) WITH ORDINALITY AS ord(attnum, n) ON true
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ord.attnum
  WHERE t.relname IN (
    'ticket','notification','invitation','league','leagues_players','tournament',
    'tournament_stage','tournament_player','tournament_match','outbox_message',
    'match','user','purchase','tournament_subscription','match_choices'
  )
  GROUP BY t.oid, i.relname
)
SELECT
  fk.table_name,
  fk.conname,
  fk.fk_cols,
  COALESCE(
    (
      SELECT string_agg(index_name, ', ' ORDER BY index_name)
      FROM idx
      WHERE idx.relid = fk.conrelid
        AND idx.idx_cols[1:cardinality(fk.fk_cols)] = fk.fk_cols
    ),
    ''
  ) AS covering_indexes
FROM fk
ORDER BY fk.table_name, fk.conname;


