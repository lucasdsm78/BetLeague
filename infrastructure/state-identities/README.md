# Bootstrap des identités S3 OVH

Cette stack crée les identités Object Storage OVH nécessaires au backend Terraform :

- un user `dev`
- un user `prod`
- une paire `access_key_id` / `secret_access_key` pour chaque user
- des policies bucket-scoped optionnelles pour limiter chaque identité à son bucket

## Pré-requis

- projet OVH Public Cloud existant
- credentials API OVH déjà créées manuellement (`application_key`, `application_secret`, `consumer_key`)

## Variables requises

```bash
export TF_VAR_ovh_application_key="..."
export TF_VAR_ovh_application_secret="..."
export TF_VAR_ovh_consumer_key="..."
export TF_VAR_service_name="..."
```

Optionnellement, copie `terraform.tfvars.example` vers `terraform.tfvars` puis complète-le localement.

## Démarrage

```bash
cd infrastructure/state-identities
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

## Outputs utiles

```bash
terraform output -raw state_dev_s3_access_key_id
terraform output -raw state_dev_s3_secret_access_key
terraform output -raw state_prod_s3_access_key_id
terraform output -raw state_prod_s3_secret_access_key
```

## Générer un `terraform.tfvars` pour `state-backend/`

Le script `../scripts/render-state-backend-tfvars.sh` transforme automatiquement les outputs de cette stack en fichier compatible avec `state-backend/`.

```bash
cd infrastructure/state-identities
../scripts/render-state-backend-tfvars.sh
```

Pour écrire directement le fichier cible :

```bash
cd infrastructure/state-identities
../scripts/render-state-backend-tfvars.sh . ../state-backend/terraform.tfvars
```

## Important

Les secret keys S3 générées sont stockées dans le `tfstate` local de cette stack. Protège-le comme un secret : stockage chiffré, sauvegarde sécurisée, accès restreint.

