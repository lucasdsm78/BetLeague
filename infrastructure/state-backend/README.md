# Bootstrap du bucket de state Terraform

Ce dossier gère les buckets S3-compatible OVH utilisés pour le state Terraform `dev` et `prod`.

Par défaut, le bucket `dev` est **temporairement désactivé** via `enable_dev_bucket = false` pour rester cohérent avec `state-identities/`.

## Variables requises

Le bootstrap attend deux paires d’identifiants Object Storage OVH via des variables Terraform, une pour `dev` et une pour `prod`. La source recommandée est désormais la stack `../state-identities/`.

Tu peux soit exporter les variables à la main :

```bash
export TF_VAR_access_key_id_dev="..."
export TF_VAR_secret_access_key_dev="..."
export TF_VAR_access_key_id_prod="..."
export TF_VAR_secret_access_key_prod="..."
```

Soit générer directement `terraform.tfvars` à partir des outputs de `state-identities/` :

```bash
cd infrastructure/state-identities
../scripts/render-state-backend-tfvars.sh . ../state-backend/terraform.tfvars
```

Optionnellement, tu peux aussi copier `terraform.tfvars.example` vers `terraform.tfvars` puis le compléter localement.

## Ce qu'il fait

- crée le bucket `betleague-terraform-state-dev`
- crée le bucket `betleague-terraform-state-prod`
- active le versioning
- active le chiffrement serveur AES256
- applique une règle de rétention des versions non courantes
- empêche la destruction accidentelle via `prevent_destroy`

Par défaut, `aws_s3_bucket_public_access_block` est **désactivé** sur OVH Object Storage (`enable_public_access_block = false`) car l’API `PutPublicAccessBlock` renvoie des conflits `409 BucketAlreadyOwnedByYou` malgré la création correcte du bucket. Les buckets restent privés tant qu’aucune ACL ou policy publique n’est ajoutée.

## GitHub Actions

Le workflow `.github/workflows/terraform-state-backend.yml` permet d’exécuter cette stack en CI/CD :

- `pull_request` / `push` : contrôles statiques uniquement
- `workflow_dispatch` : `plan` ou `apply` manuel sur un runner **self-hosted** sécurisé

Pré-requis CI recommandés :

- un environnement GitHub `state-backend` avec approbation manuelle
- un runner self-hosted portant les labels `self-hosted`, `linux`, `x64`, `state-backend`
- une variable GitHub `TF_STATE_IDENTITIES_LOCAL_BACKEND_PATH` pointant vers le state persistant de `state-identities/`
- une variable GitHub `TF_STATE_BACKEND_LOCAL_BACKEND_PATH` pointant vers un chemin persistant chiffré pour cette stack, par exemple `/srv/terraform/state-backend/terraform.tfstate`

Le workflow génère un fichier `terraform.ci.auto.tfvars` temporaire à partir des outputs de `state-identities/`, puis le supprime systématiquement en fin de job.

Pour réactiver `dev`, remets `enable_dev_state_identity = true` dans `state-identities/`, puis `enable_dev_bucket = true` dans `state-backend/`.

## Important

Ce bootstrap doit être exécuté **avant** l'utilisation du backend distant de `infrastructure/terraform/`.

Ordre recommandé :

1. `state-identities/`
2. `state-backend/`
3. `terraform/`

Si un bucket existe déjà, importe-le d'abord :

```bash
cd infrastructure/state-backend
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform import 'aws_s3_bucket.terraform_state_dev' betleague-terraform-state-dev
terraform import 'aws_s3_bucket.terraform_state_prod' betleague-terraform-state-prod
```

Puis applique la configuration :

```bash
cd infrastructure/state-backend
terraform apply
```







