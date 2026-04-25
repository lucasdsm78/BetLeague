# Infrastructure Terraform OVH - BetLeague

Cette arborescence contient une base Terraform modulaire pour déployer une infrastructure BetLeague sur OVH Public Cloud avec une approche simple, rapide et sécurisée.

## Architecture cible

- **1 instance publique OVH Public Cloud** durcie via `cloud-init`
- **1 réseau privé OVH** pour les communications internes futures
- **DNS OVH** pour `app` / `api`
- **Base PostgreSQL managée externe** recommandée (ex: Neon), volontairement hors Terraform ici
- **Secrets runtime hors Terraform** (fichiers montés en lecture seule sur le serveur)

## Modules utilisés

La stack `ovh-prod` consomme désormais directement les modules Git publiés sous le compte `lucasdsm78` :

- `terraform-cloudinit-docker-host`
- `terraform-ovh-private-network`
- `terraform-ovh-public-instance`
- `terraform-ovh-zone-records`

## Stack fournie

- `stacks/ovh-prod`

La stack référence directement des sources Git versionnées :

```hcl
source = "git::ssh://git@github.com/lucasdsm78/terraform-ovh-public-instance.git?ref=v1.0.0"
```

## Pré-requis

- Terraform >= 1.5
- Un projet OVH Public Cloud
- Un domaine OVH si tu veux gérer le DNS via Terraform
- Variables OVH exportées dans le shell :

```bash
export OVH_ENDPOINT="ovh-eu"
export OVH_APPLICATION_KEY="..."
export OVH_APPLICATION_SECRET="..."
export OVH_CONSUMER_KEY="..."
```

## Sécurité

### Important

**Ne stocke pas les secrets applicatifs dans Terraform**. Terraform les dupliquerait dans l'état (`tfstate`).

Garde hors Terraform :

- `SECRET_KEY_TOKEN`
- `SECRET_KEY_TOKEN_REFRESH`
- `ENCRYPTION_KEY`
- `PRIVATE_KEY`
- `PUBLIC_KEY`
- clés Stripe / VAPID / DB / Redis

Recommandation : stocker ces secrets sur le serveur dans `/opt/betleague/secrets/` et les monter en lecture seule dans les conteneurs.

## Référentiel des modules Git

Le mapping entre le monorepo historique et les repos Git des modules est documenté dans `MODULE_REPOS.md`.

## Démarrage rapide

```bash
cd infrastructure/stacks/ovh-prod
cp terraform.tfvars.example terraform.tfvars
cp backend.hcl.example backend.hcl
terraform init -reconfigure -backend-config=backend.hcl
terraform plan
```

## Ordre recommandé

1. Maintenir les modules Git dédiés tagués (`v1.0.0`, `v1.0.1`, ...)
2. Mettre à jour les refs Git dans `stacks/ovh-prod/main.tf`
3. Déployer la stack `ovh-prod`
4. Déployer l'application (Docker Compose ou systemd) sur l'instance
5. Injecter les secrets runtime hors Terraform

## Structure livrée

```text
infrastructure/
├── MODULE_REPOS.md
├── scripts/
└── stacks/
    └── ovh-prod/
```

