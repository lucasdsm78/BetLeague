# Dossier `terraform`

Cette stack assemble les modules Terraform OVH pour provisionner une fondation de prod BetLeague :

- une instance publique OVH Public Cloud
- un réseau privé OVH
- un bootstrap cloud-init Docker host
- des enregistrements DNS `app` / `api`

## Sources des modules

Cette stack consomme directement les repos Git dédiés des modules Terraform, versionnés par tags immuables.

Exemple :

```hcl
source = "git::ssh://git@github.com/lucasdsm78/terraform-ovh-public-instance.git?ref=v1.0.0"
```

Si tu modifies un module, publie d’abord un nouveau tag dans son repo puis mets à jour la `ref` correspondante dans `main.tf`.

## Backend distant sécurisé

Le backend Terraform est déclaré en configuration partielle dans `backend.tf` :

```hcl
terraform {
  backend "s3" {}
}
```

La configuration concrète est fournie hors Git via un fichier local `backend.hcl` basé sur `backend.hcl.example`.

### Recommandation OVH

Utilise **OVH Object Storage S3-compatible** pour stocker le state distant.

Les identifiants backend ne doivent **jamais** être committés. Exporte-les dans le shell :

```bash
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
```

## Pré-requis

- projet OVH Public Cloud existant
- domaine OVH si `create_dns_records = true`
- secrets applicatifs **hors Terraform**

## Démarrage

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
cp backend.hcl.example backend.hcl
terraform init -reconfigure -backend-config=backend.hcl
terraform plan
```

## Validation locale sans backend distant

Pour valider la stack sans accéder au backend distant :

```bash
cd infrastructure/terraform
terraform init -backend=false
terraform validate
```

## GitHub Actions

Deux workflows GitHub Actions pilotent désormais l’infrastructure :

- `terraform-ci.yml` : `fmt`, `validate` et `plan`
- `terraform-apply.yml` : déploiement manuel protégé sur l’environnement `production`

### Secrets GitHub requis

- `OVH_APPLICATION_KEY`
- `OVH_APPLICATION_SECRET`
- `OVH_CONSUMER_KEY`
- `OVH_S3_ACCESS_KEY_ID`
- `OVH_S3_SECRET_ACCESS_KEY`
- `TF_MODULES_SSH_PRIVATE_KEY`

`TF_MODULES_SSH_PRIVATE_KEY` doit être une clé SSH **read-only** capable de cloner les repos Terraform privés suivants :

- `terraform-cloudinit-docker-host`
- `terraform-ovh-private-network`
- `terraform-ovh-public-instance`
- `terraform-ovh-zone-records`

### Variables GitHub recommandées

Variables minimales à configurer dans le dépôt ou l’environnement GitHub :

- `TF_VAR_SERVICE_NAME`
- `TF_VAR_REGION`
- `TF_VAR_FLAVOR_ID`
- `TF_VAR_IMAGE_ID`

Variables optionnelles utiles :

- `TF_VAR_SSH_KEY_NAME`
- `TF_VAR_SSH_KEY_PUBLIC_KEY`
- `TF_VAR_SSH_AUTHORIZED_KEYS` (JSON, ex: `["ssh-ed25519 AAAA..."]`)
- `TF_VAR_DNS_ZONE`
- `TF_VAR_APP_SUBDOMAIN`
- `TF_VAR_API_SUBDOMAIN`

### Sécurité recommandée

- protège l’environnement GitHub `production` avec reviewers obligatoires
- n’exécute `terraform-apply.yml` qu’en manuel
- garde les credentials OVH et S3 uniquement dans les secrets GitHub
- ne commit jamais `backend.hcl`, `terraform.tfvars` ni de state Terraform

## Important

Cette stack ne déploie pas la base PostgreSQL ni les secrets runtime.

Recommandation actuelle pour BetLeague :

- PostgreSQL managé externe
- secrets montés sur le serveur dans `/opt/betleague/secrets/`
- application déployée ensuite via Docker Compose ou systemd






