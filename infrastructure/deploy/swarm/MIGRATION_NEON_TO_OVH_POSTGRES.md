# Migration des données Neon -> PostgreSQL interne OVH/VPS — BetLeague

Ce guide décrit la procédure recommandée pour **exporter les données depuis Neon** puis **les restaurer dans le PostgreSQL interne Swarm** déployé sur le VPS OVH de BetLeague.

Il complète :

- `infrastructure/deploy/swarm/RUNBOOK_DB_FAILOVER.md`
- `infrastructure/deploy/swarm/SECRETS_SECONDARY_DB.md`
- `infrastructure/scripts/migrate-neon-to-ovh-postgres.sh`

---

## Objectif

Le scénario cible est maintenant :

- **source** : Neon
- **cible** : PostgreSQL interne Swarm sur le VPS OVH
- **runtime** : `postgresql+asyncpg://betleague_app:...@postgres:5432/betleague`
- **migrations** : `postgresql+asyncpg://betleague_migrations:...@postgres:5432/betleague`
- **TLS interne** : `SQLALCHEMY_SSL_MODE=disable`

La migration recommandée est une **bascule courte, manuelle et contrôlée** avec :

1. gel des écritures,
2. dump Neon via **endpoint direct**,
3. restauration dans le PostgreSQL interne,
4. validation,
5. remise en service.

---

## 1. Règle clé : utiliser l'endpoint direct Neon

Pour le dump :

- utiliser l'URL **directe** Neon,
- ne pas utiliser le host `-pooler`.

Exemple :

```text
postgresql://USER:PASSWORD@ep-xxxx.eu-west-1.aws.neon.tech/neondb?sslmode=require
```

Pas :

```text
...@ep-xxxx-pooler....
```

---

## 2. Pré-requis

Avant la fenêtre de migration :

- le service Swarm `betleague_postgres` est déjà `1/1`,
- la stack BetLeague est convergée,
- les rôles `betleague_app` et `betleague_migrations` existent déjà dans la cible,
- `pg_dump` et `pg_restore` sont installés sur la machine d’administration,
- tu disposes d’un accès shell au VPS,
- le script est exécuté **sur le manager Swarm OVH** ou via un contexte Docker / `DOCKER_HOST` pointant vers ce manager,
- tu as l’URL **directe** Neon.

Sur macOS avec Homebrew :

```zsh
export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
pg_dump --version
pg_restore --version
psql --version
```

---

## 3. Fenêtre de migration recommandée

Pour éviter de perdre des écritures entre le dump et la bascule :

- ouvre une courte fenêtre de maintenance,
- évite toute écriture applicative pendant la migration,
- ne lance aucune migration Alembic en parallèle,
- idéalement stoppe temporairement les entrées utilisateurs critiques.

Le plus sûr en production reste une **courte indisponibilité contrôlée**.

---

## 4. Variables à préparer

Depuis ta machine d’administration ou directement sur le VPS :

```zsh
export SOURCE_DATABASE_URL='postgresql://USER:PASSWORD@NEON_DIRECT_HOST:5432/neondb?sslmode=require'
export DUMP_FILE="$HOME/betleague-neon-to-ovh-$(date +%Y%m%d-%H%M%S).dump"
```

---

## 5. Vérifications avant dump

```zsh
psql "$SOURCE_DATABASE_URL" -c 'SELECT now();'
psql "$SOURCE_DATABASE_URL" -c 'SELECT current_database();'
```

Si cela échoue, ne lance pas le dump.

---

## 6. Procédure recommandée avec le script fourni

Le script ajouté dans le repo automatise :

- le dump custom format depuis Neon via un client PostgreSQL local configurable (par défaut `postgres:17` sur le contexte Docker local),
- une sauvegarde de sécurité de la cible OVH actuelle avant écrasement,
- la copie du dump dans le conteneur PostgreSQL Swarm interne,
- le restore dans `betleague` via un client PostgreSQL configurable (par défaut `postgres:17`) connecté à la cible OVH PostgreSQL 16,
- un `vacuumdb --analyze-in-stages`,
- la vérification de `alembic_version`.

Commande :

```zsh
# exécuter cette commande sur le VPS manager OVH
# ou après avoir sélectionné un docker context / DOCKER_HOST qui cible ce manager
cd /Users/lucasdasilvamarques/BetLeague
chmod +x infrastructure/scripts/migrate-neon-to-ovh-postgres.sh
SOURCE_DATABASE_URL="$SOURCE_DATABASE_URL" \
DUMP_FILE="$DUMP_FILE" \
bash infrastructure/scripts/migrate-neon-to-ovh-postgres.sh
```

Valeurs par défaut utilisées par le script :

- `STACK_NAME=betleague`
- `POSTGRES_SERVICE_NAME=betleague_postgres`
- `TARGET_DATABASE=betleague`
- `TARGET_USER=betleague_migrations`
- `LOCAL_DOCKER_CONTEXT=default`
- `LOCAL_POSTGRES_CLIENT_IMAGE=postgres:17`
- `REMOTE_POSTGRES_CLIENT_IMAGE=postgres:17`

Fichiers générés par défaut :

- dump source Neon : `./betleague-neon-to-ovh-<timestamp>.dump`
- sauvegarde de sécurité cible OVH : `./betleague-ovh-before-restore-<timestamp>.dump`

> Ce choix évite les erreurs du type `pg_restore: unsupported version (...) in file header` et les incompatibilités de version quand la source Neon est en PostgreSQL 17 alors que la cible OVH interne tourne en PostgreSQL 16.

---

## 7. Procédure manuelle équivalente

### 7.1 Créer le dump Neon

```zsh
pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --schema=public \
  --file "$DUMP_FILE" \
  "$SOURCE_DATABASE_URL"
```

### 7.2 Vérifier l’archive

```zsh
pg_restore --list "$DUMP_FILE" > /dev/null
```

### 7.3 Localiser le conteneur PostgreSQL interne

```zsh
POSTGRES_CONTAINER_ID=$(docker ps \
  --filter label=com.docker.swarm.service.name=betleague_postgres \
  --format '{{.ID}}' | head -n1)

echo "$POSTGRES_CONTAINER_ID"
```

### 7.4 Copier l’archive dans le conteneur

```zsh
docker cp "$DUMP_FILE" "$POSTGRES_CONTAINER_ID:/tmp/betleague-neon-to-ovh.dump"
```

### 7.5 Restaurer avec le rôle migrations

```zsh
docker exec \
  -e TARGET_DATABASE=betleague \
  -e TARGET_USER=betleague_migrations \
  -e REMOTE_DUMP_PATH=/tmp/betleague-neon-to-ovh.dump \
  "$POSTGRES_CONTAINER_ID" \
  sh -lc '
    set -eu
    export PGPASSWORD="$(cat /run/secrets/postgres_migrations_password)"
    pg_restore \
      --clean \
      --if-exists \
      --no-owner \
      --no-privileges \
      --schema=public \
      --username "$TARGET_USER" \
      --dbname "$TARGET_DATABASE" \
      "$REMOTE_DUMP_PATH"
    vacuumdb --analyze-in-stages --username "$TARGET_USER" --dbname "$TARGET_DATABASE"
  '
```

### 7.6 Vérifier `alembic_version`

```zsh
docker exec "$POSTGRES_CONTAINER_ID" sh -lc '
  set -eu
  export PGPASSWORD="$(cat /run/secrets/postgres_migrations_password)"
  psql --username betleague_migrations --dbname betleague -c "TABLE alembic_version;"
'
```

---

## 8. Vérifications post-restore

Contrôles minimums :

```zsh
docker exec "$POSTGRES_CONTAINER_ID" sh -lc '
  set -eu
  export PGPASSWORD="$(cat /run/secrets/postgres_migrations_password)"
  psql --username betleague_migrations --dbname betleague -c "SELECT now();"
  psql --username betleague_migrations --dbname betleague -c "\dt public.*"
'
```

Vérifier aussi :

- nombre de tables plausible,
- données métier présentes,
- version Alembic cohérente,
- absence d’erreur `pg_restore`.

---

## 9. Bascule applicative

Si ce PostgreSQL interne Swarm est déjà la cible active de `backend.env` et `migrations.env`, il suffit de redéployer après restauration si nécessaire.

Sinon, activer :

### `backend.env`

```dotenv
SQLALCHEMY_DATABASE_URL=postgresql+asyncpg://betleague_app:REPLACE_ME@postgres:5432/betleague
SQLALCHEMY_SSL_MODE=disable
```

### `migrations.env`

```dotenv
ALEMBIC_DATABASE_URL=postgresql+asyncpg://betleague_migrations:REPLACE_ME@postgres:5432/betleague
SQLALCHEMY_SSL_MODE=disable
```

Puis redéployer la stack.

---

## 10. Validation finale

Après bascule / restore :

```zsh
docker stack services betleague
docker service logs --since 10m betleague_backend | cat
curl -fsS https://api.betleague.app/health
curl -fsS https://api.betleague.app/ready
```

Attendu :

- `betleague_postgres 1/1`
- `betleague_backend 2/2`
- `betleague_celery_worker 2/2`
- `/health` OK
- `/ready` OK

---

## 11. Rollback

Si la restauration ou la bascule échoue :

- garder le dump Neon intact,
- remettre les secrets DB précédents si nécessaire,
- redéployer vers l’ancienne cible,
- ne pas écrire simultanément sur Neon et OVH.

Le rollback doit rester **manuel et explicite**.

---

## 12. Points d’attention

- Toujours dumper Neon via **direct endpoint**.
- Éviter toute écriture pendant le dump + restore.
- Restaurer uniquement le schéma `public` pour rester aligné avec BetLeague.
- Vérifier `alembic_version` avant de relancer des migrations futures.
- Conserver le dump jusqu’à validation métier complète.

### Si la source Neon est en PostgreSQL 17

Quand Neon expose une base PostgreSQL 17.x et que la cible OVH interne est en PostgreSQL 16, il faut utiliser un client PostgreSQL **17** pour le dump et pour le restore logique.

Le script le fait désormais par défaut avec :

- `LOCAL_POSTGRES_CLIENT_IMAGE=postgres:17`
- `REMOTE_POSTGRES_CLIENT_IMAGE=postgres:17`

Tu peux garder ces valeurs par défaut, ou les surcharger explicitement si nécessaire.






