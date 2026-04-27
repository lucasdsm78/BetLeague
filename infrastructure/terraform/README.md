# Dossier `terraform`

Cette stack provisionne l’infrastructure BetLeague avec des environnements séparés `dev` et `prod`.

La cible compute recommandée et désormais préconfigurée pour la production est un **vrai OVH VPS-3** consommé via le module Git dédié `terraform-ovh-vps`.

La stack principale le consomme par exemple sous cette forme :

```hcl
source = "git::ssh://git@github.com/lucasdsm78/terraform-ovh-vps.git?ref=b2edc34ccaf5dbc76ffe87e75eaefc934a99c4bc"
```

- un OVH VPS-3
- des enregistrements DNS `app` / `api`
- des outputs dédiés pour générer l’inventaire Ansible de l’hôte

Le DNS OVH reste géré via le module Git dédié déjà pinné sur un commit immuable.

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

- compte OVH avec droits suffisants pour commander un VPS
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

Sur un OVH VPS, l’accès SSH initial est fourni par la plateforme elle-même via `vps_public_ssh_key`. Le hardening réseau fin n’est donc pas fait au moment du provisioning Terraform, mais immédiatement après via Ansible (`ufw`, `fail2ban`, durcissement SSH).

Pour exécuter Ansible en bootstrap sur un hôte neuf, le scénario recommandé est :

1. commander le VPS avec `terraform apply`
2. générer l’inventaire Ansible via `../scripts/render-ansible-inventory.py`
3. appliquer le playbook Ansible dès que l’accès SSH par clé est disponible
4. restreindre ensuite SSH aux seuls CIDR administratifs de confiance

Le provider OVH utilisé ici ne fournit pas dans cette stack un firewall hôte natif suffisant pour le hardening complet du VPS. La mitigation appliquée côté IaC est donc :

- injection d’une clé SSH publique au provisioning OVH
- hardening hôte immédiat via Ansible + `ufw` + `fail2ban`
- réduction de la surface exposée à `80/443` après bootstrap

## GitHub Actions

Le workflow principal `terraform-ci.yml` implémente :

- un seul flux logique `plan -> approval -> apply`
- le réemploi du **même** `tfplan` entre `plan` et `apply`
- des contrôles `tflint`, `tfsec` et `checkov`
- une séparation `dev` / `prod` via des backends S3 distincts

Les jobs sensibles `plan`, `apply-dev` et `apply-prod` sont rattachés à des GitHub Environments (`development` / `production`). Les secrets OVH API doivent donc être définis dans ces Environments, et non plus uniquement au niveau repository :

- `OVH_APPLICATION_KEY`
- `OVH_APPLICATION_SECRET`
- `OVH_CONSUMER_KEY`

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

## Exemple `vps-3`

Un exemple prêt à compléter est fourni dans `environments/prod/terraform.vps-3.tfvars.example`.






