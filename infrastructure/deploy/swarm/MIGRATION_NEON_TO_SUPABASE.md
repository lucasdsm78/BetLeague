# Migration de dump entre Neon et Supabase — BetLeague

Ce guide décrit la procédure recommandée pour **exporter une base PostgreSQL source** puis **la restaurer dans une base PostgreSQL cible** afin de préparer, tester ou exécuter une bascule BetLeague entre **Neon** et **Supabase**.

Il complète :

- `infrastructure/deploy/swarm/RUNBOOK_DB_FAILOVER.md`
- `infrastructure/deploy/swarm/SECRETS_SECONDARY_DB.md`

---

## Objectif

Le but est de produire un dump fiable depuis une **base source** puis de le restaurer dans une **base cible** pour :

- préparer une base secondaire de secours,
- valider la procédure de reprise,
- tester la future bascule manuelle par secrets + redéploiement,
- couvrir explicitement les deux sens de migration :
  - **Sens A : Neon -> Supabase**
  - **Sens B : Supabase -> Neon**

---

## 1. Règle clé : utiliser des connexions directes pour dump / restore

Pour les opérations de dump et de restauration, utiliser :

- **Neon** : endpoint **direct** si possible
- **Supabase** : endpoint **direct** si possible

### Pourquoi

Le dump et la restauration manipulent :

- transactions longues,
- DDL,
- métadonnées,
- flux importants,
- parfois des `SET` / commandes sensibles à la session.

Donc :

- **éviter les poolers transactionnels**,
- éviter les comportements ambigus de pooling,
- préférer une connexion PostgreSQL la plus directe possible.

### Résumé

- app runtime BetLeague → pooler session OK
- migrations → direct préférable
- dump / restore → **direct obligatoire de préférence**

## 1.1 Sens explicitement couverts

Ce guide couvre les deux variantes suivantes :

- **Sens A : Neon -> Supabase**
  - `SOURCE_DATABASE_URL` = URL directe Neon
  - `TARGET_DATABASE_URL` = URL directe Supabase
- **Sens B : Supabase -> Neon**
  - `SOURCE_DATABASE_URL` = URL directe Supabase
  - `TARGET_DATABASE_URL` = URL directe Neon

Dans toute la suite du document :

- `SOURCE_DATABASE_URL` = base depuis laquelle on exporte
- `TARGET_DATABASE_URL` = base dans laquelle on restaure

---

## 2. Pré-requis

Avant de lancer la migration :

- les deux providers existent déjà et sont accessibles si tu fais un test bidirectionnel
- les connection strings utiles ont été récupérées
- tu connais :
  - l’URL directe de la base source
  - l’URL directe de la base cible
- `pg_dump` et `pg_restore` sont installés sur la machine d’administration
- tu disposes de suffisamment d’espace disque local pour stocker le dump

### Cas réel documenté : poste local macOS

Sur macOS, les clients PostgreSQL peuvent être déjà installés via Homebrew sans être exposés dans le `PATH`.

Dans notre cas réel, les commandes suivantes retournaient initialement :

```zsh
pg_dump --version
pg_restore --version
psql --version
```

avec l’erreur :

```text
zsh: command not found
```

Le correctif a consisté à exposer `libpq` installé par Homebrew :

```zsh
export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
```

Puis, pour rendre ce correctif permanent :

```zsh
echo 'export PATH="/opt/homebrew/opt/libpq/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Vérification attendue :

```zsh
pg_dump --version
pg_restore --version
psql --version
```

### Vérifier les versions locales

```zsh
pg_dump --version
pg_restore --version
psql --version
```

Idéalement, utilise une version cliente PostgreSQL **égale ou supérieure** à la version source.

---

## 3. Informations à récupérer

## 3.1 Base source

Tu dois disposer d’une **URL directe** source, selon le sens choisi.

### Sens A : source Neon

```text
postgresql://user:password@ep-xxxx.eu-west-1.aws.neon.tech/neondb?sslmode=require
```

### Sens B : source Supabase

```text
postgresql://postgres.xxxxx:password@db.xxxxx.supabase.co:5432/postgres?sslmode=require
```

### Retour d’expérience réel côté Neon

Le premier test a été fait par erreur sur un host `-pooler`, avec un message de type :

```text
Your account or project has exceeded the compute time quota.
```

Ce message confirmait deux choses :

- Neon restait bien la source primaire,
- un dump n’était possible qu’après réactivation temporaire du compute **et** en privilégiant l’URL directe.

Pour `pg_dump`, il faut donc utiliser l’**endpoint direct Neon**, pas l’endpoint pooler.

## 3.2 Base cible

Tu dois disposer d’une **URL directe** cible, selon le sens choisi.

### Sens A : cible Supabase

```text
postgresql://postgres.xxxxx:password@aws-0-eu-west-3.pooler.supabase.com:5432/postgres
```

> Si Supabase ne te donne qu’un pooler visible dans l’UI, cherche bien l’onglet ou la section **direct connection**. Pour `pg_restore`, le direct est préférable.

### Sens B : cible Neon

```text
postgresql://user:password@ep-xxxx.eu-west-1.aws.neon.tech/neondb?sslmode=require
```

> Pour une restauration vers Neon, privilégie également l’endpoint **direct** et non le host `-pooler`.

---

## 4. Format recommandé du dump

Pour BetLeague, le format recommandé est le **format custom** PostgreSQL :

```zsh
pg_dump -Fc
```

### Pourquoi `-Fc`

Avantages :

- plus compact qu’un dump SQL brut,
- plus souple pour `pg_restore`,
- possibilité de lister le contenu,
- meilleure reprise sélective si besoin.

### À éviter par défaut

- dump SQL plain trop gros et moins pratique,
- dump fait via pooler transactionnel,
- dump “full cluster” au lieu d’un dump base ciblée.

---

## 5. Variables d’environnement recommandées

Travaille avec des variables temporaires locales.

```zsh
export SOURCE_DATABASE_URL='postgresql://USER:PASSWORD@SOURCE_DIRECT_HOST:5432/source_db?sslmode=require'
export TARGET_DATABASE_URL='postgresql://USER:PASSWORD@TARGET_DIRECT_HOST:5432/target_db?sslmode=require'
export BETLEAGUE_DUMP_FILE="$HOME/betleague-db-migration-$(date +%Y%m%d-%H%M%S).dump"
```

> N’enregistre pas ces valeurs en clair dans le dépôt.

### Mapping rapide

#### Sens A : Neon -> Supabase

```zsh
export SOURCE_DATABASE_URL='postgresql://USER:PASSWORD@NEON_DIRECT_HOST:5432/neondb?sslmode=require'
export TARGET_DATABASE_URL='postgresql://USER:PASSWORD@SUPABASE_DIRECT_HOST:5432/postgres?sslmode=require'
```

#### Sens B : Supabase -> Neon

```zsh
export SOURCE_DATABASE_URL='postgresql://USER:PASSWORD@SUPABASE_DIRECT_HOST:5432/postgres?sslmode=require'
export TARGET_DATABASE_URL='postgresql://USER:PASSWORD@NEON_DIRECT_HOST:5432/neondb?sslmode=require'
```

---

## 6. Étape 1 — Vérifier la connexion à la base source

Avant le dump :

```zsh
psql "$SOURCE_DATABASE_URL" -c 'SELECT now();'
psql "$SOURCE_DATABASE_URL" -c 'SELECT current_database();'
```

Si cela échoue, ne lance pas `pg_dump`.

### Cas réel rencontré : quota Neon dépassé

Avant que le dump réussisse, une tentative de connexion retournait :

```text
ERROR: Your account or project has exceeded the compute time quota.
```

Dans ce cas :

- le problème ne vient pas de `psql` local,
- le dump est impossible tant que **la base source** refuse les connexions,
- il faut attendre le reset du quota ou réactiver temporairement le compute côté Neon.

---

## 7. Étape 2 — Créer le dump depuis la base source

Commande recommandée :

```zsh
pg_dump \
  --format=custom \
  --verbose \
  --no-owner \
  --no-privileges \
  --file "$BETLEAGUE_DUMP_FILE" \
  "$SOURCE_DATABASE_URL"
```

### Explication

- `--format=custom` : dump restaurable avec `pg_restore`
- `--verbose` : logs utiles en cas d’échec
- `--no-owner` : évite de dépendre des rôles source
- `--no-privileges` : évite les ACL source non compatibles cible

---

## 8. Étape 3 — Vérifier le dump local

Vérifie qu’il existe bien :

```zsh
ls -lh "$BETLEAGUE_DUMP_FILE"
```

Tu peux aussi lister son contenu :

```zsh
pg_restore --list "$BETLEAGUE_DUMP_FILE" | head -n 40
```

### Cas réel observé sur BetLeague

Le dump réussi contenait à la fois :

- les tables métier BetLeague dans `public.*`
- des tables `neon_auth.*`

Exemples vus pendant le dump :

- `public.alembic_version`
- `public.user`
- `public.league`
- `public.match`
- `public.ticket`
- `public.tournament`
- `neon_auth.account`
- `neon_auth.organization`
- `neon_auth.user`

Pour BetLeague, la cible utile de reprise reste le schéma `public`.

---

## 9. Étape 4 — Vérifier la connexion à la base cible

Avant restauration :

```zsh
psql "$TARGET_DATABASE_URL" -c 'SELECT now();'
psql "$TARGET_DATABASE_URL" -c 'SELECT current_database();'
```

Si cela échoue, ne restaure pas.

---

## 10. Étape 5 — Préparer la base cible pour la restauration

Selon ton usage, tu peux :

- restaurer dans la base prévue pour BetLeague,
- ou restaurer dans un environnement de test dédié.

### Recommandation

Fais d’abord un test sur une cible non critique si possible.

### Attention

Le provider cible peut avoir des rôles, paramètres, extensions ou restrictions réseau différents de la source.

C’est pour cela qu’on utilise :

- `--no-owner`
- `--no-privileges`

---

## 11. Étape 6 — Restaurer dans la base cible

Commande recommandée :

```zsh
pg_restore \
  --verbose \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --schema=public \
  --dbname "$TARGET_DATABASE_URL" \
  "$BETLEAGUE_DUMP_FILE"
```

### Explication

- `--clean` : supprime les objets avant recréation
- `--if-exists` : évite certaines erreurs de suppression
- `--no-owner` / `--no-privileges` : évite les incompatibilités de rôles
- `--schema=public` : évite de restaurer `neon_auth.*` qui n’est pas requis pour BetLeague

### Pourquoi restaurer uniquement `public`

Dans le retour d’expérience réel, le dump Neon contenait aussi le schéma `neon_auth`.

Pour une base secondaire BetLeague, la recommandation opérationnelle est :

- restaurer le schéma métier `public`,
- ne pas tenter de réimporter `neon_auth` sauf besoin spécifique explicitement identifié.

---

## 12. Étape 7 — Vérifications post-restauration

### Vérifier que les tables existent

```zsh
psql "$TARGET_DATABASE_URL" -c '\dt'
```

### Vérifier `alembic_version`

```zsh
psql "$TARGET_DATABASE_URL" -c 'SELECT * FROM alembic_version;'
```

### Vérifier que les tables métier principales sont bien dans `public`

```zsh
psql "$TARGET_DATABASE_URL" -c '\dt public.*'
```

### Vérifier quelques volumes de données

Exemples :

```zsh
psql "$TARGET_DATABASE_URL" -c 'SELECT count(*) FROM "user";'
psql "$TARGET_DATABASE_URL" -c 'SELECT count(*) FROM league;'
psql "$TARGET_DATABASE_URL" -c 'SELECT count(*) FROM ticket;'
```

### Vérifier l’heure côté cible

```zsh
psql "$TARGET_DATABASE_URL" -c 'SELECT now();'
```

---

## 13. Étape 8 — Mapper les URLs BetLeague vers le provider cible

Une fois la restauration validée, prépare les secrets BetLeague correspondant au provider désormais actif.

### Sens A : Neon -> Supabase

### Runtime
Dans `backend.env.secondary` :

```dotenv
SQLALCHEMY_DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@SUPABASE_SESSION_POOLER_HOST:PORT/postgres
SQLALCHEMY_SSL_MODE=verify-full
```

### Migrations
Dans `migrations.env.secondary` :

```dotenv
ALEMBIC_DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@SUPABASE_DIRECT_HOST:PORT/postgres
```

> Si tu n’as pas encore deux endpoints distincts bien identifiés, tu peux temporairement utiliser l’URL directe des deux côtés pour les tests, puis optimiser ensuite.

### Sens B : Supabase -> Neon

### Runtime
Dans `backend.env` ou `backend.env.secondary` selon ton scénario :

```dotenv
SQLALCHEMY_DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@NEON_RUNTIME_HOST:PORT/neondb
SQLALCHEMY_SSL_MODE=verify-full
```

### Migrations
Dans `migrations.env` ou `migrations.env.secondary` selon ton scénario :

```dotenv
ALEMBIC_DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@NEON_DIRECT_HOST:PORT/neondb
```

---

## 14. Étape 9 — Tester BetLeague sur le provider cible

Après mise à jour des secrets, les vérifications minimales sont :

```zsh
curl -fsS https://api.betleague.app/health
curl -fsS https://api.betleague.app/ready
```

Puis tester fonctionnellement :

- connexion utilisateur
- affichage matchs
- affichage ligues
- tickets
- profil

Et surveiller les logs :

```zsh
docker service logs betleague_backend --since 10m | cat
docker service logs betleague_celery_worker --since 10m | cat
docker service logs betleague_outbox_worker --since 10m | cat
```

---

## 15. Limites et points d’attention

## 15.1 Rôles / ownership

Neon et Supabase n’ont pas forcément les mêmes rôles PostgreSQL ni les mêmes permissions système.

C’est pourquoi on évite de restaurer :

- ownership source
- ACL source

## 15.2 Extensions

Certaines extensions présentes côté source peuvent :

- être déjà gérées par le provider cible,
- être absentes,
- nécessiter une adaptation.

Après restauration, vérifie les erreurs éventuelles dans la sortie `pg_restore`.

## 15.3 Connexion via pooler

Pour rappel :

- dump / restore → direct préférable
- runtime app → session pooler recommandé
- migrations → direct préférable

## 15.4 Taille du dump

Pour une base volumineuse :

- vérifie l’espace disque local,
- évite les réseaux instables,
- garde le fichier `.dump` le temps de valider la cible.

---

## 16. Exemple complet prêt à copier

### Sens A : Neon -> Supabase

```zsh
export SOURCE_DATABASE_URL='postgresql://USER:PASSWORD@NEON_DIRECT_HOST:5432/neondb?sslmode=require'
export TARGET_DATABASE_URL='postgresql://USER:PASSWORD@SUPABASE_DIRECT_HOST:5432/postgres?sslmode=require'
export BETLEAGUE_DUMP_FILE="$HOME/betleague-neon-to-supabase-$(date +%Y%m%d-%H%M%S).dump"
```

```zsh
pg_dump \
  --format=custom \
  --verbose \
  --no-owner \
  --no-privileges \
  --file "$BETLEAGUE_DUMP_FILE" \
  "$SOURCE_DATABASE_URL"
```

```zsh
pg_restore --list "$BETLEAGUE_DUMP_FILE" | head -n 40
```

```zsh
pg_restore \
  --verbose \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --schema=public \
  --dbname "$TARGET_DATABASE_URL" \
  "$BETLEAGUE_DUMP_FILE"
```

### Sens B : Supabase -> Neon

```zsh
export SOURCE_DATABASE_URL='postgresql://USER:PASSWORD@SUPABASE_DIRECT_HOST:5432/postgres?sslmode=require'
export TARGET_DATABASE_URL='postgresql://USER:PASSWORD@NEON_DIRECT_HOST:5432/neondb?sslmode=require'
export BETLEAGUE_DUMP_FILE="$HOME/betleague-supabase-to-neon-$(date +%Y%m%d-%H%M%S).dump"
```

```zsh
pg_dump \
  --format=custom \
  --verbose \
  --no-owner \
  --no-privileges \
  --file "$BETLEAGUE_DUMP_FILE" \
  "$SOURCE_DATABASE_URL"
```

```zsh
pg_restore --list "$BETLEAGUE_DUMP_FILE" | head -n 40
```

```zsh
pg_restore \
  --verbose \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --schema=public \
  --dbname "$TARGET_DATABASE_URL" \
  "$BETLEAGUE_DUMP_FILE"
```

---

## 17. Check-list finale

Avant de déclarer une migration inter-provider prête :

- [ ] sens choisi explicitement confirmé (`Neon -> Supabase` ou `Supabase -> Neon`)
- [ ] dump de la base source réussi
- [ ] dump vérifié localement
- [ ] restore de la base cible réussi
- [ ] `alembic_version` cohérente
- [ ] volumes de données plausibles
- [ ] secrets BetLeague correspondant au provider cible mis à jour
- [ ] `/ready` OK après test
- [ ] tests métier OK

---

## 18. Fichiers liés

- `infrastructure/deploy/swarm/RUNBOOK_DB_FAILOVER.md`
- `infrastructure/deploy/swarm/SECRETS_SECONDARY_DB.md`
- `infrastructure/deploy/swarm/secrets/backend.env.secondary.example`
- `infrastructure/deploy/swarm/secrets/migrations.env.secondary.example`

Si tu veux aller encore plus loin, l’étape suivante logique est d’ajouter :

- un script shell générique `dump_provider_to_provider.sh`,
- ou un guide de test de bascule complet BetLeague entre Neon et Supabase.


