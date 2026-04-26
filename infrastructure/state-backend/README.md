# Bootstrap du bucket de state Terraform

Ce dossier gère les buckets S3-compatible OVH utilisés pour le state Terraform `dev` et `prod`.

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
- bloque tout accès public au niveau bucket
- empêche la destruction accidentelle via `prevent_destroy`

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




