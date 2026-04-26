# Infrastructure Terraform OVH - BetLeague

Cette arborescence contient une base Terraform modulaire pour déployer une infrastructure BetLeague sur OVH Public Cloud avec une approche simple, rapide et sécurisée.

## Architecture cible

- **1 instance publique OVH Public Cloud** durcie via `cloud-init`
- **1 réseau privé OVH** pour les communications internes futures
- **DNS OVH** pour `app` / `api`
- **Base PostgreSQL managée externe** recommandée (ex: Neon), volontairement hors Terraform ici
- **Secrets runtime hors Terraform** (fichiers montés en lecture seule sur le serveur)

## Modules utilisés

La stack `terraform/` consomme directement les modules Git publiés sous le compte `lucasdsm78` :

- `terraform-cloudinit-docker-host`
- `terraform-ovh-private-network`
- `terraform-ovh-public-instance`
- `terraform-ovh-zone-records`

## Dossiers Terraform fournis

- `state-identities/`
- `terraform/`
- `state-backend/`

La stack référence directement des sources Git pinnées sur des commits immuables :

```hcl
source = "git::ssh://git@github.com/lucasdsm78/terraform-ovh-public-instance.git?ref=cb8ba898d1b63fbb8c054f91dad0abfad2b826b1"
```

## Pré-requis

- Terraform ~> 1.14
- Un projet OVH Public Cloud
- Un domaine OVH si tu veux gérer le DNS via Terraform
- Variables OVH exportées dans le shell :

```bash
export OVH_ENDPOINT="ovh-eu"
export OVH_APPLICATION_KEY="..."
export OVH_APPLICATION_SECRET="..."
export OVH_CONSUMER_KEY="..."
```

Pour le backend Terraform distant, les credentials OVH Object Storage `dev` / `prod` peuvent désormais être générées par la stack `state-identities/`.

En CI GitHub Actions, cela correspond aux secrets :

- `OVH_S3_ACCESS_KEY_ID_DEV`
- `OVH_S3_SECRET_ACCESS_KEY_DEV`
- `OVH_S3_ACCESS_KEY_ID_PROD`
- `OVH_S3_SECRET_ACCESS_KEY_PROD`

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
cd infrastructure/state-identities
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform apply

../scripts/render-state-backend-tfvars.sh . ../state-backend/terraform.tfvars

cd ../state-backend
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform apply

cd ../terraform
cp terraform.tfvars.example terraform.tfvars
cp environments/prod/backend.hcl.example backend.hcl
terraform init -reconfigure -backend-config=backend.hcl
terraform plan
```

## Ordre recommandé

1. Maintenir les modules Git dédiés pinnés sur des commits immuables
2. Générer/rotater les identités S3 du backend dans `state-identities/`
3. Bootstraper/maintenir les buckets de state dans `state-backend/`
4. Mettre à jour les refs Git dans `terraform/main.tf`
5. Déployer l'infrastructure Terraform
6. Déployer l'application (Docker Compose ou systemd) sur l'instance
7. Injecter les secrets runtime hors Terraform

Le bootstrap `state-identities/` crée désormais les identités Object Storage S3 `dev` / `prod`, et `state-backend/` crée les buckets dédiés `betleague-terraform-state-dev` et `betleague-terraform-state-prod`.

## Structure livrée

```text
infrastructure/
├── MODULE_REPOS.md
├── scripts/
├── state-identities/
├── state-backend/
└── terraform/
```

