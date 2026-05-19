# Migration de dump Neon → Supabase — BetLeague

Ce guide décrit la procédure recommandée pour **exporter la base PostgreSQL primaire hébergée sur Neon** puis **la restaurer dans Supabase** afin de préparer ou tester la base secondaire de BetLeague.

Il complète :

- `infrastructure/deploy/swarm/RUNBOOK_DB_FAILOVER.md`
- `infrastructure/deploy/swarm/SECRETS_SECONDARY_DB.md`

---

## Objectif

Le but est de produire un dump fiable depuis **Neon** puis de le restaurer dans **Supabase** pour :

- préparer une base secondaire de secours,
- valider la procédure de reprise,
- tester la future bascule manuelle par secrets + redéploiement.

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

---

## 2. Pré-requis

Avant de lancer la migration :

- un projet Supabase existe déjà
- les connection strings Supabase ont été récupérées
- tu connais :
  - l’URL directe Neon source
  - l’URL directe Supabase cible
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

## 3.1 Source Neon

Tu dois disposer d’une **URL directe** source, par exemple :

```text
postgresql://user:password@ep-xxxx.eu-west-1.aws.neon.tech/neondb?sslmode=require
```

### Retour d’expérience réel

Le premier test a été fait par erreur sur un host `-pooler`, avec un message de type :

```text
Your account or project has exceeded the compute time quota.
```

Ce message confirmait deux choses :

- Neon restait bien la source primaire,
- un dump n’était possible qu’après réactivation temporaire du compute **et** en privilégiant l’URL directe.

Pour `pg_dump`, il faut donc utiliser l’**endpoint direct Neon**, pas l’endpoint pooler.

## 3.2 Cible Supabase

Tu dois disposer d’une **URL directe** cible, par exemple :

```text
postgresql://postgres.xxxxx:password@aws-0-eu-west-3.pooler.supabase.com:5432/postgres
```

> Si Supabase ne te donne qu’un pooler visible dans l’UI, cherche bien l’onglet ou la section **direct connection**. Pour `pg_restore`, le direct est préférable.

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
export NEON_DIRECT_URL='postgresql://USER:PASSWORD@NEON_DIRECT_HOST:5432/neondb?sslmode=require'
export SUPABASE_DIRECT_URL='postgresql://USER:PASSWORD@SUPABASE_DIRECT_HOST:5432/postgres?sslmode=require'
export BETLEAGUE_DUMP_FILE="$HOME/betleague-neon-$(date +%Y%m%d-%H%M%S).dump"
```

> N’enregistre pas ces valeurs en clair dans le dépôt.

---

## 6. Étape 1 — Vérifier la connexion à Neon

Avant le dump :

```zsh
psql "$NEON_DIRECT_URL" -c 'SELECT now();'
psql "$NEON_DIRECT_URL" -c 'SELECT current_database();'
```

Si cela échoue, ne lance pas `pg_dump`.

### Cas réel rencontré : quota Neon dépassé

Avant que le dump réussisse, une tentative de connexion retournait :

```text
ERROR: Your account or project has exceeded the compute time quota.
```

Dans ce cas :

- le problème ne vient pas de `psql` local,
- le dump est impossible tant que Neon refuse les connexions,
- il faut attendre le reset du quota ou réactiver temporairement le compute côté Neon.

---

## 7. Étape 2 — Créer le dump depuis Neon

Commande recommandée :

```zsh
pg_dump \
  --format=custom \
  --verbose \
  --no-owner \
  --no-privileges \
  --file "$BETLEAGUE_DUMP_FILE" \
  "$NEON_DIRECT_URL"
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

## 9. Étape 4 — Vérifier la connexion à Supabase

Avant restauration :

```zsh
psql "$SUPABASE_DIRECT_URL" -c 'SELECT now();'
psql "$SUPABASE_DIRECT_URL" -c 'SELECT current_database();'
```

Si cela échoue, ne restaure pas.

---

## 10. Étape 5 — Préparer Supabase pour la restauration

Selon ton usage, tu peux :

- restaurer dans la base prévue pour BetLeague,
- ou restaurer dans un environnement de test dédié.

### Recommandation

Fais d’abord un test sur une cible non critique si possible.

### Attention

Supabase est un PostgreSQL managé ; certains rôles ou paramètres source peuvent ne pas exister côté cible.

C’est pour cela qu’on utilise :

- `--no-owner`
- `--no-privileges`

---

## 11. Étape 6 — Restaurer dans Supabase

Commande recommandée :

```zsh
pg_restore \
  --verbose \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --schema=public \
  --dbname "$SUPABASE_DIRECT_URL" \
  "$BETLEAGUE_DUMP_FILE"
```

### Explication

- `--clean` : supprime les objets avant recréation
- `--if-exists` : évite certaines erreurs de suppression
- `--no-owner` / `--no-privileges` : évite les incompatibilités de rôles
- `--schema=public` : évite de restaurer `neon_auth.*` qui n’est pas requis pour BetLeague

### Pourquoi restaurer uniquement `public`

Dans le retour d’expérience réel, le dump Neon contenait aussi le schéma `neon_auth`.

Pour une base secondaire BetLeague sur Supabase, la recommandation opérationnelle est :

- restaurer le schéma métier `public`,
- ne pas tenter de réimporter `neon_auth` sauf besoin spécifique explicitement identifié.

---

## 12. Étape 7 — Vérifications post-restauration

### Vérifier que les tables existent

```zsh
psql "$SUPABASE_DIRECT_URL" -c '\dt'
```

### Vérifier `alembic_version`

```zsh
psql "$SUPABASE_DIRECT_URL" -c 'SELECT * FROM alembic_version;'
```

### Vérifier que les tables métier principales sont bien dans `public`

```zsh
psql "$SUPABASE_DIRECT_URL" -c '\dt public.*'
```

### Vérifier quelques volumes de données

Exemples :

```zsh
psql "$SUPABASE_DIRECT_URL" -c 'SELECT count(*) FROM "user";'
psql "$SUPABASE_DIRECT_URL" -c 'SELECT count(*) FROM league;'
psql "$SUPABASE_DIRECT_URL" -c 'SELECT count(*) FROM ticket;'
```

### Vérifier l’heure côté cible

```zsh
psql "$SUPABASE_DIRECT_URL" -c 'SELECT now();'
```

---

## 13. Étape 8 — Mapper les URLs BetLeague vers Supabase

Une fois la restauration validée, prépare les secrets secondaires de BetLeague.

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

---

## 14. Étape 9 — Tester BetLeague sur Supabase

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

- être déjà gérées par Supabase,
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

### Variables

```zsh
export NEON_DIRECT_URL='postgresql://USER:PASSWORD@NEON_DIRECT_HOST:5432/neondb?sslmode=require'
export SUPABASE_DIRECT_URL='postgresql://USER:PASSWORD@SUPABASE_DIRECT_HOST:5432/postgres?sslmode=require'
export BETLEAGUE_DUMP_FILE="$HOME/betleague-neon-$(date +%Y%m%d-%H%M%S).dump"
```

### Dump

```zsh
pg_dump \
  --format=custom \
  --verbose \
  --no-owner \
  --no-privileges \
  --file "$BETLEAGUE_DUMP_FILE" \
  "$NEON_DIRECT_URL"
```

### Vérification

```zsh
pg_restore --list "$BETLEAGUE_DUMP_FILE" | head -n 40
```

### Restore

```zsh
pg_restore \
  --verbose \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --schema=public \
  --dbname "$SUPABASE_DIRECT_URL" \
  "$BETLEAGUE_DUMP_FILE"
```

---

## 17. Check-list finale

Avant de déclarer “Neon → Supabase prêt” :

- [ ] dump Neon réussi
- [ ] dump vérifié localement
- [ ] restore Supabase réussi
- [ ] `alembic_version` cohérente
- [ ] volumes de données plausibles
- [ ] secrets BetLeague secondaires mis à jour
- [ ] `/ready` OK après test
- [ ] tests métier OK

---

## 18. Fichiers liés

- `infrastructure/deploy/swarm/RUNBOOK_DB_FAILOVER.md`
- `infrastructure/deploy/swarm/SECRETS_SECONDARY_DB.md`
- `infrastructure/deploy/swarm/secrets/backend.env.secondary.example`
- `infrastructure/deploy/swarm/secrets/migrations.env.secondary.example`

Si tu veux aller encore plus loin, l’étape suivante logique est d’ajouter :

- un script shell `dump_neon_to_supabase.sh`,
- ou un guide de test de bascule complet BetLeague sur Supabase.


