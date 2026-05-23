# Guide de remplissage des secrets DB secondaires — BetLeague

Ce document explique **exactement quelles valeurs renseigner** dans les secrets de secours pour la base PostgreSQL secondaire de BetLeague.

Il complète :

- `infrastructure/deploy/swarm/RUNBOOK_DB_FAILOVER.md`
- `infrastructure/deploy/swarm/MIGRATION_NEON_TO_SUPABASE.md`
- `infrastructure/deploy/swarm/secrets/backend.env.secondary.example`
- `infrastructure/deploy/swarm/secrets/migrations.env.secondary.example`

---

## Objectif

Préparer une base secondaire de secours avec :

- **runtime applicatif** via `SQLALCHEMY_DATABASE_URL`
- **migrations Alembic** via `ALEMBIC_DATABASE_URL`

Le modèle validé pour BetLeague est :

- **primaire** : Neon
- **secondaire** : PostgreSQL OVH/VPS
- **bascule** : manuelle

---

## 1. Ce qui change vraiment entre primaire et secondaire

Dans les secrets secondaires, **seules les variables base de données changent**.

### Fichier `backend.env.secondary.example`
À adapter principalement :

- `SQLALCHEMY_DATABASE_URL`
- `SQLALCHEMY_SSL_MODE`

### Fichier `migrations.env.secondary.example`
À adapter :

- `ALEMBIC_DATABASE_URL`

### Le reste
Les autres secrets dans `backend.env.secondary.example` restent globalement :

- identiques à la prod actuelle,
- sauf si ton infra secondaire change aussi Redis/NATS/Stripe/etc.

En pratique, pour une méthode de secours DB simple :
- **Redis** reste le même
- **NATS** reste le même
- **frontend URL / CORS** restent les mêmes
- **clés JWT / chiffrement** restent les mêmes

---

## 2. Format exact attendu par BetLeague

Le backend BetLeague attend des URLs PostgreSQL compatibles `asyncpg`.

### Runtime
```dotenv
SQLALCHEMY_DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST:PORT/DATABASE
```

### Migrations
```dotenv
ALEMBIC_DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST:PORT/DATABASE
```

---

## 3. Valeurs à renseigner champ par champ

| Champ | Signification | Valeur attendue | Exemple interne VPS | Exemple externe SSL |
|---|---|---|---|---|
| `USER` | utilisateur PostgreSQL | utilisateur dédié BetLeague | `betleague_app` | `betleague_app` |
| `PASSWORD` | mot de passe PostgreSQL | secret long aléatoire | `...` | `...` |
| `HOST` | hôte DB secondaire | DNS privé, IP privée ou FQDN | `pg-secondary.internal` | `db-secondary.betleague.app` |
| `PORT` | port PostgreSQL | généralement `5432` | `5432` | `5432` |
| `DATABASE` | nom de base | base BetLeague | `betleague` | `betleague` |

---

## 4. Utilisateurs recommandés

Je te conseille d’utiliser **2 utilisateurs distincts**.

### Runtime applicatif
Pour `SQLALCHEMY_DATABASE_URL` :

- utilisateur : `betleague_app`
- droits : lecture/écriture applicative normale
- pas nécessairement superuser

### Migrations
Pour `ALEMBIC_DATABASE_URL` :

- utilisateur : `betleague_migrations`
- droits DDL nécessaires aux migrations
- réservé aux migrations uniquement

---

## 5. Cas n°1 — PostgreSQL secondaire sur réseau privé OVH/VPS

C’est le scénario le plus simple et recommandé.

### Quand l’utiliser
- la base tourne sur le même VPS ou un hôte privé atteignable seulement par le backend
- la DB n’est pas exposée publiquement
- accès restreint par firewall / réseau privé / iptables / ufw

### Valeurs recommandées
#### `backend.env.secondary.example`
```dotenv
SQLALCHEMY_DATABASE_URL=postgresql+asyncpg://betleague_app:REPLACE_ME@pg-secondary.internal:5432/betleague
SQLALCHEMY_SSL_MODE=disable
```

#### `migrations.env.secondary.example`
```dotenv
ALEMBIC_DATABASE_URL=postgresql+asyncpg://betleague_migrations:REPLACE_ME@pg-secondary.internal:5432/betleague
```

### Pourquoi `disable`
Dans ton code actuel (`back/infrastructure/postgresql/engine_factory.py`), les modes supportés sont :

- `disable`
- `verify-full`

Donc pour une DB **interne privée non TLS**, mets :

```dotenv
SQLALCHEMY_SSL_MODE=disable
```

---

## 6. Cas n°2 — PostgreSQL secondaire exposée via TLS/SSL

À utiliser si ta DB secondaire est atteignable via un endpoint externe chiffré.

### Valeurs recommandées
#### `backend.env.secondary.example`
```dotenv
SQLALCHEMY_DATABASE_URL=postgresql+asyncpg://betleague_app:REPLACE_ME@db-secondary.betleague.app:5432/betleague
SQLALCHEMY_SSL_MODE=verify-full
```

#### `migrations.env.secondary.example`
```dotenv
ALEMBIC_DATABASE_URL=postgresql+asyncpg://betleague_migrations:REPLACE_ME@db-secondary.betleague.app:5432/betleague
```

### Important
Ton backend ne supporte **pas** `require` ou des variantes intermédiaires.

Donc :
- si DB interne privée sans TLS → `disable`
- si DB externe TLS correctement certifiée → `verify-full`

### CA privée / certificat autosigné
Si la DB externe utilise bien TLS mais présente une **CA privée** (ou une chaîne incluant un certificat autosigné), garde :

```dotenv
SQLALCHEMY_SSL_MODE=verify-full
```

et ajoute aussi le certificat racine dans l'env file concerné, sur **une seule ligne** avec des retours à la ligne échappés :

```dotenv
SQLALCHEMY_SSL_ROOT_CERT=-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----
```

Tu peux mettre cette variable :

- dans `backend.env.secondary.example` si le runtime applicatif utilise aussi cette CA,
- ou uniquement dans `migrations.env.secondary.example` si seule la connexion Alembic en a besoin.

---

## 7. Valeurs concrètes à préparer

Voici ce que tu dois réellement décider/remplir.

### 7.1 Host de secours
Choisir un vrai host, par exemple :

- `10.0.0.20`
- `postgres-secondary.internal`
- `pg-secondary.betleague.internal`
- `db-secondary.betleague.app`

### 7.2 Nom de base
Recommandé :

```dotenv
betleague
```

### 7.3 Utilisateur runtime
Recommandé :

```dotenv
betleague_app
```

### 7.4 Utilisateur migrations
Recommandé :

```dotenv
betleague_migrations
```

### 7.5 Mots de passe
Génère des secrets forts.

Exemple :

```zsh
openssl rand -base64 32
```

Tu peux générer :

- un mot de passe pour `betleague_app`
- un mot de passe pour `betleague_migrations`

---

## 8. Exemple prêt à remplir — scénario recommandé OVH/VPS interne

## `backend.env.secondary.example`
```dotenv
SQLALCHEMY_DATABASE_URL=postgresql+asyncpg://betleague_app:<MOT_DE_PASSE_APP>@pg-secondary.internal:5432/betleague
SQLALCHEMY_SSL_MODE=disable
```

## `migrations.env.secondary.example`
```dotenv
ALEMBIC_DATABASE_URL=postgresql+asyncpg://betleague_migrations:<MOT_DE_PASSE_MIGRATIONS>@pg-secondary.internal:5432/betleague
```

---

## 9. Check-list avant de déclarer les secrets prêts

Avant de considérer les secrets secondaires comme “prêts” :

- [ ] l’hôte secondaire existe vraiment
- [ ] PostgreSQL 15/16 est installé
- [ ] la base `betleague` existe
- [ ] l’utilisateur `betleague_app` existe
- [ ] l’utilisateur `betleague_migrations` existe
- [ ] les droits sont corrects
- [ ] le backend peut atteindre l’hôte
- [ ] le port `5432` est ouvert seulement depuis le backend si nécessaire
- [ ] `SQLALCHEMY_SSL_MODE` correspond au vrai mode réseau (`disable` ou `verify-full`)
- [ ] un test `SELECT 1` fonctionne
- [ ] une restauration de dump a déjà été testée

---

## 10. Test minimal recommandé

Quand les secrets sont remplis, teste d’abord la connectivité.

### Test runtime
```zsh
python - <<'PY'
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://betleague_app:REPLACE_ME@pg-secondary.internal:5432/betleague"

async def main():
    engine = create_async_engine(DATABASE_URL)
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    await engine.dispose()

asyncio.run(main())
PY
```

### Test migrations
```zsh
python - <<'PY'
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://betleague_migrations:REPLACE_ME@pg-secondary.internal:5432/betleague"

async def main():
    engine = create_async_engine(DATABASE_URL)
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    await engine.dispose()

asyncio.run(main())
PY
```

---

## 11. Résumé ultra-court

### Si ta DB secondaire est interne OVH/VPS
Utilise :

```dotenv
SQLALCHEMY_DATABASE_URL=postgresql+asyncpg://betleague_app:<PASSWORD>@<HOST_INTERNE>:5432/betleague
SQLALCHEMY_SSL_MODE=disable
ALEMBIC_DATABASE_URL=postgresql+asyncpg://betleague_migrations:<PASSWORD_DDL>@<HOST_INTERNE>:5432/betleague
```

### Si ta DB secondaire est externe avec vrai TLS
Utilise :

```dotenv
SQLALCHEMY_DATABASE_URL=postgresql+asyncpg://betleague_app:<PASSWORD>@<HOST_TLS>:5432/betleague
SQLALCHEMY_SSL_MODE=verify-full
ALEMBIC_DATABASE_URL=postgresql+asyncpg://betleague_migrations:<PASSWORD_DDL>@<HOST_TLS>:5432/betleague
```

---

## 12. Fichiers concernés

- `infrastructure/deploy/swarm/secrets/backend.env.secondary.example`
- `infrastructure/deploy/swarm/secrets/migrations.env.secondary.example`
- `infrastructure/deploy/swarm/RUNBOOK_DB_FAILOVER.md`

Si tu veux aller plus loin, l’étape suivante logique est de préparer aussi :

- le script de création PostgreSQL secondaire,
- le script de sauvegarde `pg_dump`,
- et le mode maintenance/read-only pendant la bascule.


