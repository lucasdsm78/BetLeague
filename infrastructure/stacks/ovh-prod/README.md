# Stack `ovh-prod`

Cette stack assemble les modules Terraform OVH pour provisionner une fondation de prod BetLeague :

- une instance publique OVH Public Cloud
- un réseau privé OVH
- un bootstrap cloud-init Docker host
- des enregistrements DNS `app` / `api`

## Sources des modules

Par défaut, cette stack continue d’utiliser les modules locaux `../../modules/...` afin de rester **immédiatement validable** tant que les repos Git dédiés ne sont pas encore publiés.

La conversion prête à l’emploi vers des **URLs Git** est fournie dans `git-module-sources.example.txt`.

Tu peux basculer soit :

- vers le **monorepo BetLeague** avec des sources du type `git::https://github.com/lucasdsm78/BetLeague.git//infrastructure/modules/...?...`
- vers des **repos modules dédiés** avec des tags immuables `?ref=vX.Y.Z`

⚠️ Important : le `ref` Git choisi doit déjà contenir `infrastructure/modules` sur GitHub. Si ces fichiers ne sont présents que localement et pas encore pushés, `terraform init` échouera.

Exemple monorepo BetLeague :

```hcl
source = "git::https://github.com/lucasdsm78/BetLeague.git//infrastructure/modules/ovh-public-instance?ref=dev"
```

Exemple repos dédiés :

```hcl
source = "git::ssh://git@github.com/YOUR_ORG/terraform-ovh-public-instance.git?ref=v1.0.0"
```

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
cd infrastructure/stacks/ovh-prod
cp terraform.tfvars.example terraform.tfvars
cp backend.hcl.example backend.hcl
terraform init -reconfigure -backend-config=backend.hcl
terraform plan
```

## Validation locale sans backend distant

Pour valider la stack sans accéder au backend distant :

```bash
cd infrastructure/stacks/ovh-prod
terraform init -backend=false
terraform validate
```

## Important

Cette stack ne déploie pas la base PostgreSQL ni les secrets runtime.

Recommandation actuelle pour BetLeague :

- PostgreSQL managé externe
- secrets montés sur le serveur dans `/opt/betleague/secrets/`
- application déployée ensuite via Docker Compose ou systemd





