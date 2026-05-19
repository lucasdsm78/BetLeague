# Déploiement Docker Swarm sécurisé de BetLeague

Cette arborescence fournit une cible **Docker Swarm mono-manager, single-node** adaptée au `VPS-3` OVH actuellement provisionné par Terraform.

## Hypothèses

- 1 seul nœud Swarm manager
- PostgreSQL **externe/managé**
- Redis et NATS hébergés sur le VPS
- seules les entrées `80/443` sont publiées publiquement
- tous les autres services restent sur un réseau `overlay` interne

## Sources officielles vérifiées

Les recommandations de ce bundle ont été recoupées avec les pages Docker officielles suivantes :

- Docker Swarm mode — `https://docs.docker.com/engine/swarm/swarm-mode/`
- Docker secrets — `https://docs.docker.com/engine/swarm/secrets/`
- Docker configs — `https://docs.docker.com/engine/swarm/configs/`
- Compose Deploy Specification — `https://docs.docker.com/reference/compose-file/deploy/`
- Compose services — `https://docs.docker.com/reference/compose-file/services/`

## Best practices appliquées ici

- images immuables prébuildées (`BETLEAGUE_BACKEND_IMAGE`, `BETLEAGUE_FRONTEND_IMAGE`)
- secrets Docker Swarm pour les données sensibles
- configs Docker Swarm pour les fichiers non sensibles
- réseau `overlay` interne dédié à l'application
- le réseau `app` reste `internal: true`; tout service ayant besoin d’egress vers des dépendances managées/externe (ex. Neon, API-Sports) doit aussi être rattaché au réseau `edge` — c’est notamment le cas du service one-shot `migrations`
- publication publique limitée au reverse proxy `edge`
- `read_only`, `tmpfs`, `cap_drop: ALL`, utilisateurs non-root, permissions strictes sur les secrets Docker (`0400`)
- healthchecks, limites mémoire/CPU/PIDs, rolling updates avec rollback, `stop_grace_period` explicites pour les services sensibles
- placement explicite sur le manager labellisé `betleague.role=manager`
- hardening hôte avec `ufw` Docker-aware: seuls SSH restreint + `80/443` sont censés rester exposables publiquement
- Nginx edge/frontend durci : `server_tokens off`, headers de sécurité, CSP distinctes app/API, redirection HTTPS stricte, timeouts bornés, méthodes limitées côté app SPA, rate limiting ciblé sur l’API, deny défensif des routes FastAPI de documentation et cache explicite sur `index.html`
- backend prod servi par Gunicorn + workers Uvicorn, avec timeouts, `max_requests` et logs stdout adaptés au déploiement conteneurisé
- métriques Prometheus multiprocess backend écrites sur le tmp runtime writable (`BETLEAGUE_PYTHON_TMP`, par défaut `/dev/shm`) pour rester compatibles avec les conteneurs `read_only`
- releases applicatives backend/frontend en rolling update `start-first`, avec migrations DB exécutées avant le déploiement de la nouvelle révision backend
- déploiement convergent via Ansible

## Limites et décisions de sécurité

- Le cluster est **mono-nœud**: pas de haute disponibilité native.
- Les réseaux `overlay` ne sont pas marqués `attachable`, pour éviter des attaches ad hoc.
- Les certificats NATS restent traités comme secrets Docker, mais le TLS edge public est désormais géré directement sur l’hôte via Let’s Encrypt puis monté en lecture seule dans `edge`.
- Le backend charge son environnement depuis un secret `backend.env`; aucun `.env` sensible n'est committé.
- L'image backend doit embarquer un utilisateur applicatif `1000:1000` pour rester compatible avec la stack Swarm fournie.
- NATS JetStream persiste sur un volume monté sous `/var/tmp`, afin de rester rootless avec l'image upstream.
- Le TLS edge public est émis en **ECDSA P-256** par défaut ; le certificat autosigné de bootstrap généré avant la première émission Let’s Encrypt utilise la même famille de clé pour éviter un écart inutile entre bootstrap et runtime final.

## Fichiers principaux

```text
infrastructure/deploy/swarm/
├── MIGRATION_NEON_TO_SUPABASE.md
├── SECRETS_SECONDARY_DB.md
├── RUNBOOK_DB_FAILOVER.md
├── stack.prod.yml
└── secrets/
    ├── *.example
    └── backend.env.example
```

Un runbook dédié à la bascule DB primaire → secondaire est disponible dans :

- `infrastructure/deploy/swarm/RUNBOOK_DB_FAILOVER.md`

Un guide dédié au **remplissage exact** des secrets DB secondaires est disponible dans :

- `infrastructure/deploy/swarm/SECRETS_SECONDARY_DB.md`

Un guide dédié à l’export / restauration **Neon → Supabase** est disponible dans :

- `infrastructure/deploy/swarm/MIGRATION_NEON_TO_SUPABASE.md`

Des modèles de secrets de secours sont également fournis :

- `infrastructure/deploy/swarm/secrets/backend.env.secondary.example`
- `infrastructure/deploy/swarm/secrets/migrations.env.secondary.example`

## Préparation

### 1. Préparer les valeurs d'entrée

La structure finale ne repose plus sur des scripts shell locaux ni sur un `.env` rendu côté dépôt.

Les entrées de déploiement sont désormais portées par :

- le rôle Ansible `swarm_stack`
- le playbook `infrastructure/ansible/playbooks/deploy_swarm.yml`
- les variables/secrets GitHub Environment utilisés par `terraform-ci.yml` ou `app-release.yml`

### 2. Préparer les secrets d'exemple si tu veux tester localement Ansible

```bash
cd /Users/lucasdasilvamarques/BetLeague/infrastructure/deploy/swarm
cp secrets/backend.env.example secrets/backend.env
cp secrets/migrations.env.example secrets/migrations.env
cp secrets/grafana_admin_password.txt.example secrets/grafana_admin_password.txt
cp secrets/grafana_secret_key.txt.example secrets/grafana_secret_key.txt
cp secrets/monitoring_htpasswd.example secrets/monitoring_htpasswd
cp secrets/alertmanager.yml.example secrets/alertmanager.yml
cp secrets/redis_password.txt.example secrets/redis_password.txt
cp secrets/nats_user.txt.example secrets/nats_user.txt
cp secrets/nats_password.txt.example secrets/nats_password.txt
cp secrets/nats-ca-cert.pem.example secrets/nats-ca-cert.pem
cp secrets/nats-server-cert.pem.example secrets/nats-server-cert.pem
cp secrets/nats-server-key.pem.example secrets/nats-server-key.pem
cp secrets/nats-client-cert.pem.example secrets/nats-client-cert.pem
cp secrets/nats-client-key.pem.example secrets/nats-client-key.pem
```

### 3. Renseigner `secrets/backend.env`

Adapte en particulier :

- `SQLALCHEMY_DATABASE_URL`
- `SQLALCHEMY_SSL_MODE`
- `SQLALCHEMY_POOL_RECYCLE`
- `SQLALCHEMY_POOL_TIMEOUT`
- `SECRET_KEY_TOKEN`
- `SECRET_KEY_TOKEN_REFRESH`
- `ENCRYPTION_KEY`
- `STRIPE_API_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `REDIS_URL`
- `CELERY_BROKER_URL`
- `CELERY_RESULT_BACKEND`
- `APP_FRONTEND_URL`
- `CORS_ALLOWED_ORIGINS`
- `TRUSTED_HOSTS`
- `TRUSTED_PROXY_IPS`
- `NATS_*`

Avec **Neon**, la stratégie recommandée est :

- `SQLALCHEMY_DATABASE_URL` → **endpoint poolé** Neon pour le runtime applicatif (`backend`, `celery`, `outbox`)
- `migrations.env` / `MIGRATIONS_ENV` → contient uniquement `ALEMBIC_DATABASE_URL`, sur **endpoint direct** Neon pour les migrations Alembic

Cela permet de garder une bonne élasticité côté application tout en évitant les surprises liées au pooler transactionnel pendant les migrations de schéma.

Le backend Python applique aussi un hardening TLS `verify-full` côté `asyncpg` via `certifi`, un `application_name` PostgreSQL explicite par composant et un tuning de pool SQLAlchemy aligné sur Neon (`pool_pre_ping`, `pool_recycle`, `pool_timeout`, `command_timeout`).

## Initialiser puis déployer la stack

La voie officielle est désormais :

1. Terraform provisionne le VPS
2. Ansible initialise Swarm avec `playbooks/init_swarm.yml`
3. Ansible déploie la stack avec `playbooks/deploy_swarm.yml`

## Déploiement via GitHub Actions

Oui, cette stack peut être déployée entièrement via GitHub Actions.

Le chemin recommandé est désormais :

- Terraform via `terraform-ci.yml`
- hardening hôte via `harden-host-dev` / `harden-host-prod`
- puis déploiement Swarm via le playbook Ansible `infrastructure/ansible/playbooks/deploy_swarm.yml`

### Releases backend/frontend sans downtime perceptible

Pour publier une release applicative (ex. `backend:1.0.0`, `frontend:1.0.0`) sans interruption perceptible côté utilisateur :

1. pousse des images immuables (tag versionné ou digest) pour `BETLEAGUE_BACKEND_IMAGE` et `BETLEAGUE_FRONTEND_IMAGE`
2. soit mets à jour ces références dans l'Environment GitHub ciblé puis lance `app-release.yml`
3. soit lance directement `app-release.yml` avec des overrides `backend_image` / `frontend_image`

Le rôle Ansible `swarm_stack` :

- précharge les nouvelles images sur le nœud
- expose aussi un service one-shot `migrations` pour les releases applicatives dédiées, rattaché à `edge` + `app`
- exécute `./scripts/run_migrations.sh` **avant** le déploiement Swarm complet via un conteneur one-shot lancé en `--network host`
- ou, en mode release dédiée, déclenche ensuite un rolling update séquencé backend → workers → frontend

Cela supprime le principal trou de disponibilité précédent, où l'unique conteneur `backend` s'arrêtait pour appliquer les migrations avant de redémarrer.

### Workflow dédié `app-release.yml` (sans Terraform)

Un workflow dédié `/.github/workflows/app-release.yml` permet désormais de redéployer l'application **sans relancer Terraform**.

Ce workflow visible sert de point d’entrée manuel et délègue l’exécution au workflow réutilisable `/.github/workflows/_swarm-deploy.yml`, partagé aussi par `terraform-ci.yml`. On garde ainsi un seul socle pour :

- la génération d’inventaire Ansible
- la préparation SSH et des variables de connexion
- la construction de `swarm-vars.json`
- le contrôle syntaxique Ansible
- l’appel d’un playbook Ansible autorisé (`deploy_swarm.yml` ou `release_swarm.yml`)

Pour la release applicative dédiée, `app-release.yml` appelle `infrastructure/ansible/playbooks/release_swarm.yml`, tandis que `terraform-ci.yml` conserve `infrastructure/ansible/playbooks/deploy_swarm.yml` pour l’initialisation/déploiement complet.

Le workflow de release construit l'inventaire Ansible directement à partir des variables GitHub Environment suivantes :

- `DEPLOY_HOST` (**requis**) : IP ou DNS de l'hôte cible
- `DEPLOY_USER` (**requis**) : utilisateur SSH d'administration
- `DEPLOY_HOSTNAME` (optionnel) : alias Ansible lisible, ex. `betleague-prod`
- `DEPLOY_GROUP` (optionnel) : groupe d'inventaire, défaut `betleague_vps3`
- `DEPLOY_COMPOSE_ROOT` (optionnel) : racine runtime, défaut dérivé depuis `DEPLOY_PATH` ou `/opt/betleague`

Ce workflow ne dépend donc plus de l'artefact `terraform-outputs.json` ni des outputs Terraform pour retrouver l'hôte cible.

Important : ce modèle sans downtime suppose des migrations de schéma **backward-compatible** (stratégie _expand / contract_). Une migration destructive ou incompatible avec l'ancienne version backend peut toujours créer une coupure logique, même si Swarm garde les conteneurs en rotation.

### Stratégie recommandée

Pour un mono-VPS avec le setup BetLeague actuel, le compromis recommandé est désormais :

- runner **self-hosted approuvé** (par exemple ton Mac dédié) sélectionné via la variable de dépôt `BETLEAGUE_SELF_HOSTED_RUNNER_LABELS_JSON`
- connexion **SSH stricte** vers le VPS
- secrets stockés dans les GitHub Environments `development` / `production`
- approbation manuelle de l’Environment avant déploiement sensible

Évite en revanche d’exécuter ce runner self-hosted directement sur le serveur de prod.

Dans le chemin `terraform-ci.yml`, l’hôte cible et l’utilisateur SSH sont récupérés depuis les outputs Terraform. Dans le chemin `app-release.yml`, ils viennent directement de `DEPLOY_HOST` / `DEPLOY_USER` (ou des overrides saisis au lancement). Dans les deux cas, le compte administrateur utilisé doit :

- pouvoir écrire dans `DEPLOY_PATH`
- appartenir au groupe `docker` sur le VPS
- être limité à l’authentification par clé

### Workflows fournis

Les jobs Swarm de `/.github/workflows/terraform-ci.yml` suivent désormais le même enchaînement en `development` et `production` :

1. `apply-dev` / `apply-prod` provisionne ou met à jour le VPS et publie les outputs Terraform
2. `harden-host-dev` / `harden-host-prod` applique `harden_host.yml` sur l’hôte
3. `deploy-swarm-dev` / `deploy-swarm-prod` délègue au workflow réutilisable `/.github/workflows/_swarm-deploy.yml`
4. injecte les vars/secrets Swarm depuis l’Environment GitHub ciblé
5. lance le playbook `deploy_swarm.yml`
6. attend la convergence de la stack puis vérifie l’API

Le workflow dédié `app-release.yml` réutilise exactement le même socle, mais en mode **sans Terraform** : l’hôte cible vient alors de `DEPLOY_HOST` / `DEPLOY_USER` (ou des overrides saisis au lancement manuel) au lieu d’un artefact `terraform-outputs.json`.

En plus, il utilise `release_swarm.yml`, qui orchestre explicitement :

1. la vérification d’existence des images backend/frontend
2. l’exécution du service one-shot `betleague_migrations`
3. le rolling update du backend
4. le rolling update des workers backend
5. le rolling update du frontend
6. les smoke tests HTTP finaux sur l’API et le frontend

### Variables GitHub Environment recommandées

Dans chaque Environment GitHub (`development` et `production`), configure au minimum :

- `STACK_NAME`
- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_HOSTNAME` (optionnel)
- `DEPLOY_GROUP` (optionnel)
- `DEPLOY_COMPOSE_ROOT` (optionnel)
- `APP_DOMAIN`
- `API_DOMAIN`
- `GRAFANA_DOMAIN`
- `PROMETHEUS_DOMAIN`
- `BETLEAGUE_BACKEND_IMAGE`
- `BETLEAGUE_FRONTEND_IMAGE`
- `GUNICORN_WORKERS`
- `GUNICORN_FORWARDED_ALLOW_IPS`
- `PROMETHEUS_SCRAPE_INTERVAL` (optionnel, défaut `30s`)
- `PROMETHEUS_SCRAPE_TIMEOUT` (optionnel, défaut `10s`)
- `PROMETHEUS_EVALUATION_INTERVAL` (optionnel, défaut `30s`)
- `PROMETHEUS_RETENTION_TIME` (optionnel, défaut `7d`)
- `PROMETHEUS_RETENTION_SIZE` (optionnel, défaut `4GB`)
- `MONITORING_ALLOWLIST_CIDRS` (**requis par défaut**) pour limiter `grafana` / `prometheus` à vos IP/VPN
- `LETSENCRYPT_EMAIL`
- `LETSENCRYPT_STAGING` (optionnel, `true` recommandé en environnement de développement public)
- `LETSENCRYPT_PRODUCTION_ACK` (optionnel, requis uniquement si `LETSENCRYPT_STAGING=false` lors d'un `deploy_swarm.yml` en production)
- `SSH_PORT`
- `SSH_TRUSTED_CIDRS`
- `DEPLOY_PATH`
- `API_HEALTHCHECK_URL`
- `REGISTRY_SERVER` (optionnel)
- `REGISTRY_USERNAME` (optionnel)

`SSH_TRUSTED_CIDRS` doit contenir au moins un CIDR autorisé à conserver l’accès SSH après hardening, par exemple `203.0.113.10/32` ou une liste séparée par virgules/sauts de ligne.

`GUNICORN_FORWARDED_ALLOW_IPS` est injecté explicitement par GitHub Actions puis Ansible au moment du `docker stack deploy`, au même titre que `GUNICORN_WORKERS`. Pour la topologie Swarm actuelle (backend non publié derrière le reverse proxy interne), la valeur pragmatique par défaut reste `*`, avec possibilité de la restreindre si tu maîtrises précisément les IP source du proxy.

Le TLS edge public est désormais géré par `certbot` directement sur l’hôte via Let’s Encrypt (`HTTP-01` avec webroot). La CI ne transporte donc plus la clé privée publique edge ; elle fournit seulement `LETSENCRYPT_EMAIL` et, si besoin, `LETSENCRYPT_STAGING`.

Pour réduire le risque de bloquer ton domaine sur les rate limits Let’s Encrypt, le workflow complet `deploy_swarm.yml` refuse aussi une première émission directe en production tant que `LETSENCRYPT_PRODUCTION_ACK=true` n’a pas été défini explicitement dans l’Environment GitHub après validation du chemin en staging.

Attention : `harden-host-dev` / `deploy-swarm-dev` et `harden-host-prod` / `deploy-swarm-prod` sont des jobs distincts. Il faut donc que `SSH_TRUSTED_CIDRS` couvre le chemin SSH réellement utilisé après hardening (runner self-hosted, bastion, VPN ou plage réseau explicitement assumée). Avec un runner self-hosted sur ton Mac, pense à autoriser son IP publique de sortie en CIDR `/32` si elle est stable.

### Secrets GitHub Environment recommandés

- `SSH_PRIVATE_KEY`
- `SSH_KNOWN_HOSTS`
- `BACKEND_ENV`
- `MIGRATIONS_ENV`
- `GRAFANA_ADMIN_PASSWORD`
- `GRAFANA_SECRET_KEY`
- `MONITORING_HTPASSWD`
- `ALERTMANAGER_CONFIG` (optionnel)
- `REDIS_PASSWORD`
- `NATS_USER`
- `NATS_PASSWORD`
- `NATS_CA_CERT`
- `NATS_SERVER_CERT`
- `NATS_SERVER_KEY`
- `NATS_CLIENT_CERT`
- `NATS_CLIENT_KEY`
- `REGISTRY_PASSWORD` (optionnel si registre privé)

`MONITORING_HTPASSWD` doit contenir une ligne `htpasswd` bcrypt complète, par exemple générée avec `htpasswd -nBC 12 monitoring`.

`GRAFANA_ADMIN_PASSWORD` doit être un secret long et aléatoire ; la validation Ansible impose au moins 24 caractères.

`GRAFANA_SECRET_KEY` doit être un secret stable, long et aléatoire, distinct du mot de passe admin ; la validation Ansible impose au moins 32 caractères. Exemple de génération : `openssl rand -base64 48`.

`ALERTMANAGER_CONFIG`, lorsqu'il est défini, doit contenir la configuration YAML complète des receivers/routes (email, webhook, Slack, etc.). Si ce secret est absent, BetLeague génère une configuration neutre locale, ne démarre pas le service `alertmanager` et Prometheus n'envoie pas de notifications externes tant que tu ne fournis pas de vraie configuration.

### Restreindre Grafana / Prometheus à une seule IP fixe

Si tu veux un accès uniquement depuis **ta propre IP fixe**, définis :

```text
MONITORING_ALLOWLIST_CIDRS=<TON_IP_FIXE>/32
```

Exemple :

```text
MONITORING_ALLOWLIST_CIDRS=203.0.113.42/32
```

Avec la configuration Nginx fournie, cela impose :

- IP source autorisée par `allow` / `deny`
- **et** authentification `auth_basic`

Donc même si quelqu’un connaît l’URL `grafana.<domaine>` ou `prometheus.<domaine>`, l’accès restera bloqué hors de cette IP.

Si tu administres aussi le serveur depuis cette même IP fixe, garde en parallèle `SSH_TRUSTED_CIDRS=<TON_IP_FIXE>/32` dans l’Environment GitHub/infra pour éviter de te bloquer après hardening.

### Monitoring intégré

La stack Swarm inclut désormais :

- `prometheus`
- `grafana`
- `alertmanager` (optionnel)
- `node_exporter`
- `cadvisor`

Le design de sécurité appliqué est le suivant :

- seules les entrées `80/443` restent exposées publiquement
- `grafana` et `prometheus` passent uniquement par `edge` en HTTPS
- protection supplémentaire par `auth_basic` côté Nginx via `MONITORING_HTPASSWD`
- `MONITORING_ALLOWLIST_CIDRS` permet en plus une restriction IP/VPN
- l’endpoint backend `/metrics` n’est pas exposé publiquement
- Prometheus scrape les replicas backend via `tasks.backend`; comme ces cibles sont des IPs de tasks Docker, le backend sert `/metrics` avant `TrustedHostMiddleware` pour éviter les rejets `Invalid host header`, tandis que Nginx bloque `/metrics` côté API publique
- les métriques applicatives restent à faible cardinalité (`method`, `route`, `status_code`, `queue`)

Le bundle monitoring expose notamment :

- usage mémoire hôte (`node_memory_MemAvailable_bytes`)
- swap utilisée
- CPU totale hôte et load average
- mémoire/CPU par conteneur via `cadvisor`
- redémarrages et OOM kills conteneurs
- latence HTTP backend p95/p99 via histogramme Prometheus
- profondeur des queues Celery Redis via `betleague_celery_queue_depth`

Pour limiter la consommation RAM/disque sur un VPS, Prometheus est borné par défaut avec :

- rétention temporelle `7d`
- rétention taille `4GB`
- timeout de requête `30s`
- concurrence de requêtes `10`
- limites de samples/labels par scrape côté configuration rendue

Le backend FastAPI utilise aussi le mode multiprocess de `prometheus-client` avec Gunicorn, afin d’agréger correctement les métriques entre workers Uvicorn sans augmenter la cardinalité avec des labels dynamiques.

### Exemples de secrets monitoring fournis

Sous `infrastructure/deploy/swarm/secrets/` :

- `grafana_admin_password.txt.example`
- `grafana_secret_key.txt.example`
- `monitoring_htpasswd.example`
- `alertmanager.yml.example`

`BACKEND_ENV` et `MIGRATIONS_ENV` doivent rester dans un format `.env` strict compatible à la fois avec `docker run --env-file` et avec le sourcing shell côté stack Swarm : lignes `KEY=value`, commentaires commençant par `#`, lignes vides. Évite `KEY = value`, `export KEY=value`, les retours chariot Windows `CRLF` et toute valeur multiligne. Pour les clés PEM applicatives comme `PRIVATE_KEY` / `PUBLIC_KEY`, utilise une seule ligne avec des retours à la ligne échappés (`\n`) ; le backend BetLeague les renormalise au démarrage.

Les secrets et configs Docker Swarm sont immuables : Docker n’autorise pas la mise à jour de leur contenu sous un même nom. Le rôle Ansible `swarm_stack` génère donc des noms réels suffixés par un hash de contenu (`<stack>_backend_env_<hash>`, `<stack>_edge_nginx_conf_<hash>`, etc.) et les injecte dans `stack.prod.yml`, tout en conservant des chemins montés stables comme `/run/secrets/backend_env` et `/run/secrets/migrations_env` dans les conteneurs.

### Déclenchement

Deux chemins coexistent désormais.

#### Déploiement infra + applicatif via `terraform-ci.yml`

Le déploiement Swarm s’exécute dans `terraform-ci.yml` quand tu lances un `workflow_dispatch` avec :

- `target_environment=dev` ou `target_environment=prod`
- `confirm_apply=APPLY`

#### Release applicative seule via `app-release.yml`

Le workflow dédié s'exécute via `workflow_dispatch` avec :

- `target_environment=dev` ou `target_environment=prod`
- `confirm_release=RELEASE`
- `backend_image` (optionnel)
- `frontend_image` (optionnel)
- `deploy_host` / `deploy_user` (optionnels, si tu veux surcharger les variables d'Environment)

## Vérifications post-déploiement

```bash
docker stack services betleague
docker stack ps betleague
docker service logs betleague_backend --follow
docker service logs betleague_edge --follow
```

Teste ensuite :

- `https://app.<domaine>`
- `https://api.<domaine>/health`
- `https://grafana.<domaine>`
- `https://prometheus.<domaine>/-/ready`

Exemples de vérifications monitoring côté hôte :

```bash
docker stack services betleague
docker service logs betleague_prometheus --follow
docker service logs betleague_grafana --follow
docker service logs betleague_alertmanager --follow
curl -kI https://grafana.<domaine>
curl -kI https://prometheus.<domaine>
```

Teste aussi le renouvellement à blanc sur l’hôte :

```bash
sudo certbot renew --dry-run
```

## Remarques importantes

- Le service `jetstream_provision` est volontairement one-shot.
- Le service `migrations` est volontairement défini avec `replicas: 0` dans la stack, puis activé uniquement lors d’une release applicative dédiée.
- Les migrations DB restent exécutées **avant** `docker stack deploy` par Ansible pour le déploiement complet, via un conteneur one-shot en `--network host`, et via le service one-shot `migrations` (attaché à `edge` + `app`) pour la release applicative dédiée.
- Le secret runtime `backend.env` ne doit plus contenir `ALEMBIC_DATABASE_URL` : l’URL DDL de migration vit désormais dans un secret séparé `migrations.env` / `MIGRATIONS_ENV`, monté uniquement pour les migrations.
- Les releases `frontend`/`backend` sont maintenant conçues pour être appliquées sans downtime perceptible côté application, mais `edge` reste mono-réplique sur ports `80/443` en mode `host` : une mise à jour du reverse proxy lui-même n'offre pas le même niveau de continuité qu'un vrai cluster multi-nœuds.
- Le certificat Let’s Encrypt est obtenu via `HTTP-01` sur le port `80`, puis synchronisé dans un répertoire hôte monté en lecture seule dans `edge`; le hook de renouvellement recharge ensuite Nginx sans repasser par des secrets GitHub.
- Premier bootstrap recommandé : `LETSENCRYPT_STAGING=true`, vérification HTTPS complète, puis second déploiement avec `LETSENCRYPT_STAGING=false` et `LETSENCRYPT_PRODUCTION_ACK=true` pour obtenir le certificat public final.
- Pour un vrai niveau production avancé, il faudra ensuite ajouter ou renforcer : sauvegardes restaurables testées, rotation DNS-01 si wildcard/multi-nœud, pipeline de build/release d'images par digest, et éventuellement une stratégie de rétention longue hors VPS pour les métriques.











