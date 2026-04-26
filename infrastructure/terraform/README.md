# Dossier `terraform`

Cette stack assemble les modules Terraform OVH pour provisionner l’infrastructure BetLeague avec des environnements séparés `dev` et `prod`.

- une instance publique OVH Public Cloud
- un réseau privé OVH
- un bootstrap cloud-init Docker host
- des enregistrements DNS `app` / `api`

## Sources des modules

Cette stack consomme directement les repos Git dédiés des modules Terraform, versionnés par commit SHA immuable.

Exemple :

```hcl
source = "git::ssh://git@github.com/lucasdsm78/terraform-ovh-public-instance.git?ref=cb8ba898d1b63fbb8c054f91dad0abfad2b826b1"
```

Si tu modifies un module, publie la nouvelle version dans son repo puis mets à jour la `ref` correspondante dans `main.tf` avec le SHA à promouvoir.

## Backend distant sécurisé

Le backend Terraform est déclaré en configuration partielle dans `backend.tf` :

```hcl
terraform {
  backend "s3" {}
}
```

La configuration concrète est fournie hors Git via un fichier local `backend.hcl` basé sur un des exemples suivants :

- `environments/dev/backend.hcl.example`
- `environments/prod/backend.hcl.example`

Par défaut, `dev` pointe vers `betleague-terraform-state-dev` et `prod` vers `betleague-terraform-state-prod`.

### Recommandation OVH

Utilise **OVH Object Storage S3-compatible** pour stocker le state distant.

Les credentials S3 du backend peuvent être générées par `../state-identities/`, puis injectées dans `../state-backend/` et dans la CI.

Les identifiants backend ne doivent **jamais** être committés. Exporte-les dans le shell :

```bash
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
```

Utilise une paire de credentials Object Storage distincte pour chaque environnement.

## Pré-requis

- projet OVH Public Cloud existant
- stack `../state-identities/` appliquée ou credentials S3 `dev` / `prod` déjà disponibles
- domaine OVH si `create_dns_records = true`
- secrets applicatifs **hors Terraform**
- bucket de state bootstrapé avec versioning actif (voir `../state-backend/`)

## Démarrage

```bash
cd infrastructure/state-identities
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform apply

../scripts/render-state-backend-tfvars.sh . ../state-backend/terraform.tfvars

cd ../state-backend
terraform init
terraform apply

cd ../terraform
cp terraform.tfvars.example terraform.tfvars
cp environments/prod/backend.hcl.example backend.hcl
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

## Important

Cette stack ne déploie pas la base PostgreSQL ni les secrets runtime.

SSH public est **désactivé par défaut** dans cette stack pour éviter une exposition mondiale du port 22. Si tu veux rouvrir SSH publiquement, passe `enable_public_ssh = true` explicitement dans l’environnement ciblé.

Le provider OVH utilisé ici ne fournit pas de ressource Terraform native exploitable pour un vrai security group/firewall Public Cloud dans cette stack. La mitigation appliquée côté IaC est donc :

- fermeture publique de SSH par défaut
- exposition limitée à `80/443`
- hardening hôte via cloud-init + `ufw` + `fail2ban`

## GitHub Actions

Le workflow principal `terraform-ci.yml` implémente :

- un seul flux logique `plan -> approval -> apply`
- le réemploi du **même** `tfplan` entre `plan` et `apply`
- des contrôles `tflint`, `tfsec` et `checkov`
- une séparation `dev` / `prod` via des backends S3 distincts

Les secrets GitHub Actions attendus pour le backend S3 sont :

- `OVH_S3_ACCESS_KEY_ID_DEV`
- `OVH_S3_SECRET_ACCESS_KEY_DEV`
- `OVH_S3_ACCESS_KEY_ID_PROD`
- `OVH_S3_SECRET_ACCESS_KEY_PROD`

Le fichier `.github/workflows/terraform-static-checks.yml` est le workflow réutilisable de contrôles statiques appelé par le workflow principal.

Ces secrets peuvent être alimentés à partir des outputs de `state-identities/`.

Recommandation actuelle pour BetLeague :

- PostgreSQL managé externe
- secrets montés sur le serveur dans `/opt/betleague/secrets/`
- application déployée ensuite via Docker Compose ou systemd






