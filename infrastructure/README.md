# Infrastructure Terraform OVH - BetLeague

Cette arborescence contient une base Terraform + Ansible pour déployer une infrastructure BetLeague sur **un vrai OVH VPS-3**, avec un backend Terraform distant stocké sur OVH Object Storage.

## Architecture cible

- **1 OVH VPS-3** durci ensuite via Ansible
- **DNS OVH** pour `app` / `api`
- **Base PostgreSQL managée externe** recommandée (ex: Neon), volontairement hors Terraform ici
- **Secrets runtime hors Terraform** (fichiers montés en lecture seule sur le serveur)

## Composants utilisés

La stack `terraform/` consomme désormais le repo GitHub dédié `terraform-ovh-vps` pour la partie compute, pinné sur un SHA immuable dans `terraform/main.tf`, et conserve le module Git de DNS OVH.

## Dossiers Terraform fournis

- `state-identities/`
- `terraform/`
- `ansible/`
- `state-backend/`

Le backend Terraform distant reste compatible OVH Object Storage S3-compatible via `state-identities/` et `state-backend/`.

## Pré-requis

- Terraform ~> 1.14
- Un compte OVH avec droits de commande VPS
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

Les secrets OVH API (`OVH_APPLICATION_KEY`, `OVH_APPLICATION_SECRET`, `OVH_CONSUMER_KEY`) sont attendus dans les GitHub Environments utilisés par les jobs sensibles, par exemple `development`, `production` et `state-identities`.

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
5. Déployer l'infrastructure Terraform (le plan ciblé est un vrai `VPS-3`)
6. Générer l’inventaire Ansible depuis les outputs Terraform
7. Appliquer le hardening hôte via Ansible
8. Déployer l'application (Docker Compose ou systemd) sur le VPS
9. Injecter les secrets runtime hors Terraform

Le bootstrap `state-identities/` crée désormais les identités Object Storage S3 `dev` / `prod`, et `state-backend/` crée les buckets dédiés `betleague-terraform-state-dev` et `betleague-terraform-state-prod`.

Le workflow GitHub Actions dédié `.github/workflows/terraform-state-identities.yml` exécute les checks en CI et réserve le `plan/apply` à un runner self-hosted approuvé pour éviter l’exfiltration des credentials S3 générées.

Le workflow `.github/workflows/terraform-state-backend.yml` prend ensuite le relais pour créer les buckets de state à partir des credentials générées par `state-identities/`, également sur runner self-hosted approuvé.

## Structure livrée

```text
infrastructure/
├── MODULE_REPOS.md
├── scripts/
├── state-identities/
├── state-backend/
├── terraform/
└── ansible/
```

