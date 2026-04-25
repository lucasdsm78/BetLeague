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

## Important

Cette stack ne déploie pas la base PostgreSQL ni les secrets runtime.

Recommandation actuelle pour BetLeague :

- PostgreSQL managé externe
- secrets montés sur le serveur dans `/opt/betleague/secrets/`
- application déployée ensuite via Docker Compose ou systemd






