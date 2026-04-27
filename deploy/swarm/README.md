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
- `read_only`, `tmpfs`, healthchecks, limites mémoire/CPU, rolling updates avec rollback
- placement explicite sur le manager labellisé `betleague.role=manager`
- préflight avant déploiement (`scripts/preflight.sh`)

## Limites et décisions de sécurité

- Le cluster est **mono-nœud**: pas de haute disponibilité native.
- Les réseaux `overlay` ne sont pas marqués `attachable`, pour éviter des attaches ad hoc.
- Les certificats TLS edge et NATS sont traités comme secrets Docker.
- Le backend charge son environnement depuis un secret `backend.env`; aucun `.env` sensible n'est committé.

## Fichiers principaux

```text
deploy/swarm/
├── .env.example
├── stack.prod.yml
├── templates/
│   └── edge.conf.template
├── scripts/
│   ├── deploy_stack.sh
│   ├── preflight.sh
│   └── render_stack_assets.py
└── secrets/
    ├── *.example
    └── backend.env.example
```

## Préparation

### 1. Copier les exemples locaux

```bash
cd /Users/lucasdasilvamarques/BetLeague/deploy/swarm
cp .env.example .env
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

### 2. Renseigner les variables d'environnement

Dans `.env` :

- `STACK_NAME`
- `APP_DOMAIN`
- `API_DOMAIN`
- `BETLEAGUE_BACKEND_IMAGE`
- `BETLEAGUE_FRONTEND_IMAGE`
- `UVICORN_WORKERS`

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

## Initialiser le nœud Swarm

L'initialisation peut être faite via Ansible ou manuellement.

Exemple manuel sur le VPS :

```bash
docker swarm init
node_id="$(docker info -f '{{.Swarm.NodeID}}')"
docker node update --label-add betleague.role=manager "$node_id"
```

## Déployer la stack

### Préflight

```bash
cd /Users/lucasdasilvamarques/BetLeague/deploy/swarm
./scripts/preflight.sh
```

### Déploiement

```bash
cd /Users/lucasdasilvamarques/BetLeague/deploy/swarm
./scripts/deploy_stack.sh
```

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

