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
- publication publique limitée au reverse proxy `edge`
- `read_only`, `tmpfs`, `cap_drop: ALL`, utilisateurs non-root, permissions strictes sur les secrets Docker (`0400`)
- healthchecks, limites mémoire/CPU/PIDs, rolling updates avec rollback, `stop_grace_period` explicites pour les services sensibles
- placement explicite sur le manager labellisé `betleague.role=manager`
- hardening hôte avec `ufw` Docker-aware: seuls SSH restreint + `80/443` sont censés rester exposables publiquement
- Nginx edge/frontend durci : `server_tokens off`, headers de sécurité, CSP distinctes app/API, redirection HTTPS stricte, timeouts bornés, méthodes limitées côté app SPA, rate limiting ciblé sur l’API, deny défensif des routes FastAPI de documentation et cache explicite sur `index.html`
- backend prod servi par Gunicorn + workers Uvicorn, avec timeouts, `max_requests` et logs stdout adaptés au déploiement conteneurisé
- déploiement convergent via Ansible

## Limites et décisions de sécurité

- Le cluster est **mono-nœud**: pas de haute disponibilité native.
- Les réseaux `overlay` ne sont pas marqués `attachable`, pour éviter des attaches ad hoc.
- Les certificats TLS edge et NATS sont traités comme secrets Docker.
- Le backend charge son environnement depuis un secret `backend.env`; aucun `.env` sensible n'est committé.
- L'image backend doit embarquer un utilisateur applicatif `1000:1000` pour rester compatible avec la stack Swarm fournie.
- NATS JetStream persiste sur un volume monté sous `/var/tmp`, afin de rester rootless avec l'image upstream.

## Fichiers principaux

```text
infrastructure/deploy/swarm/
├── stack.prod.yml
└── secrets/
    ├── *.example
    └── backend.env.example
```

## Préparation

### 1. Préparer les valeurs d'entrée

La structure finale ne repose plus sur des scripts shell locaux ni sur un `.env` rendu côté dépôt.

Les entrées de déploiement sont désormais portées par :

- le rôle Ansible `swarm_stack`
- le playbook `infrastructure/ansible/playbooks/deploy_swarm.yml`
- les variables/secrets GitHub Environment utilisés par `terraform-ci.yml`

### 2. Préparer les secrets d'exemple si tu veux tester localement Ansible

```bash
cd /Users/lucasdasilvamarques/BetLeague/infrastructure/deploy/swarm
cp secrets/backend.env.example secrets/backend.env
cp secrets/redis_password.txt.example secrets/redis_password.txt
cp secrets/nats_user.txt.example secrets/nats_user.txt
cp secrets/nats_password.txt.example secrets/nats_password.txt
cp secrets/tls.crt.pem.example secrets/tls.crt.pem
cp secrets/tls.key.pem.example secrets/tls.key.pem
cp secrets/nats-ca-cert.pem.example secrets/nats-ca-cert.pem
cp secrets/nats-server-cert.pem.example secrets/nats-server-cert.pem
cp secrets/nats-server-key.pem.example secrets/nats-server-key.pem
cp secrets/nats-client-cert.pem.example secrets/nats-client-cert.pem
cp secrets/nats-client-key.pem.example secrets/nats-client-key.pem
```

### 3. Renseigner `secrets/backend.env`

Adapte en particulier :

- `SQLALCHEMY_DATABASE_URL`
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

### Stratégie recommandée

Pour un mono-VPS, le meilleur compromis **sécurité + rapidité** est :

- runner **GitHub-hosted**
- connexion **SSH stricte** vers le VPS
- secrets stockés dans les GitHub Environments `development` / `production`
- approbation manuelle de l’Environment avant déploiement sensible

Cette approche évite d’exécuter un runner self-hosted directement sur le serveur de prod.

L’hôte cible et l’utilisateur SSH sont récupérés depuis les outputs Terraform. Le compte administrateur exposé par Terraform doit :

- pouvoir écrire dans `DEPLOY_PATH`
- appartenir au groupe `docker` sur le VPS
- être limité à l’authentification par clé

### Workflow fourni

Les jobs Swarm de `/.github/workflows/terraform-ci.yml` suivent désormais le même enchaînement en `development` et `production` :

1. `apply-dev` / `apply-prod` provisionne ou met à jour le VPS et publie les outputs Terraform
2. `harden-host-dev` / `harden-host-prod` applique `harden_host.yml` sur l’hôte
3. `deploy-swarm-dev` / `deploy-swarm-prod` génère l'inventaire Ansible automatiquement
4. injecte les vars/secrets Swarm depuis l’Environment GitHub ciblé
5. lance le playbook `deploy_swarm.yml`
6. attend la convergence de la stack puis vérifie l’API

### Variables GitHub Environment recommandées

Dans chaque Environment GitHub (`development` et `production`), configure au minimum :

- `STACK_NAME`
- `APP_DOMAIN`
- `API_DOMAIN`
- `BETLEAGUE_BACKEND_IMAGE`
- `BETLEAGUE_FRONTEND_IMAGE`
- `GUNICORN_WORKERS`
- `GUNICORN_FORWARDED_ALLOW_IPS`
- `SSH_PORT`
- `SSH_TRUSTED_CIDRS`
- `DEPLOY_PATH`
- `API_HEALTHCHECK_URL`
- `REGISTRY_SERVER` (optionnel)
- `REGISTRY_USERNAME` (optionnel)

`SSH_TRUSTED_CIDRS` doit contenir au moins un CIDR autorisé à conserver l’accès SSH après hardening, par exemple `203.0.113.10/32` ou une liste séparée par virgules/sauts de ligne.

`GUNICORN_FORWARDED_ALLOW_IPS` est injecté explicitement par GitHub Actions puis Ansible au moment du `docker stack deploy`, au même titre que `GUNICORN_WORKERS`. Pour la topologie Swarm actuelle (backend non publié derrière le reverse proxy interne), la valeur pragmatique par défaut reste `*`, avec possibilité de la restreindre si tu maîtrises précisément les IP source du proxy.

Attention : `harden-host-dev` / `deploy-swarm-dev` et `harden-host-prod` / `deploy-swarm-prod` sont des jobs distincts. Si tu utilises des runners GitHub-hosted, le second job peut partir d’une autre IP. Il faut donc que `SSH_TRUSTED_CIDRS` couvre le chemin SSH réellement utilisé après hardening (bastion, VPN, runner self-hosted ou plage réseau explicitement assumée).

### Secrets GitHub Environment recommandés

- `SSH_PRIVATE_KEY`
- `SSH_KNOWN_HOSTS`
- `BACKEND_ENV`
- `REDIS_PASSWORD`
- `NATS_USER`
- `NATS_PASSWORD`
- `EDGE_TLS_CERT`
- `EDGE_TLS_KEY`
- `NATS_CA_CERT`
- `NATS_SERVER_CERT`
- `NATS_SERVER_KEY`
- `NATS_CLIENT_CERT`
- `NATS_CLIENT_KEY`
- `REGISTRY_PASSWORD` (optionnel si registre privé)

### Déclenchement

Le déploiement Swarm s’exécute dans `terraform-ci.yml` quand tu lances un `workflow_dispatch` avec :

- `target_environment=dev` ou `target_environment=prod`
- `confirm_apply=APPLY`

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

## Remarques importantes

- Le service `jetstream_provision` est volontairement one-shot.
- Les migrations DB sont lancées par le `backend` avant son démarrage; sur un mono-réplique cela reste acceptable, mais il faudra externaliser cette étape si tu passes à plusieurs réplicas backend.
- Pour un vrai niveau production avancé, il faudra ensuite ajouter : monitoring, rotation TLS automatisée, sauvegardes et pipeline de build/release d'images.











