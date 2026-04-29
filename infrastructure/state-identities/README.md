# Bootstrap des identités S3 OVH

Cette stack crée les identités Object Storage OVH nécessaires au backend Terraform :

- un user `dev`
- un user `prod`
- une paire `access_key_id` / `secret_access_key` pour chaque user
- des policies bucket-scoped optionnelles pour limiter chaque identité à son bucket

Par défaut, l’identité `dev` est **temporairement désactivée** via `enable_dev_state_identity = false` afin de ne gérer que `prod` pendant le bootstrap courant.

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

Pour réactiver `dev`, passe `enable_dev_state_identity = true`.

## Démarrage

```bash
cd infrastructure/state-identities
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

## GitHub Actions

Le workflow `.github/workflows/terraform-state-identities.yml` suit une stratégie en deux temps :

- `pull_request` / `push` : contrôles statiques uniquement, sans exposer les secrets OVH sur les forks
- `workflow_dispatch` : `plan` ou `apply` manuel sur un runner **self-hosted** sécurisé

Pré-requis CI recommandés :

- un environnement GitHub `state-identities` avec approbation manuelle
- une variable de dépôt GitHub `BETLEAGUE_SELF_HOSTED_RUNNER_LABELS_JSON` contenant un tableau JSON de labels pour le runner approuvé, par exemple `["self-hosted","macOS"]` ou `["self-hosted","macOS","betleague-mac"]`
- Python 3.11+ déjà installé sur ce runner (les workflows self-hosted BetLeague utilisent désormais `python3` local au lieu de `actions/setup-python`)
- une variable GitHub `TF_STATE_IDENTITIES_LOCAL_BACKEND_PATH` pointant vers un chemin persistant chiffré sur ce runner, par exemple `/Users/github-actions/terraform/state-identities/terraform.tfstate`
- une variable GitHub `TF_VAR_SERVICE_NAME_STATE_IDENTITIES`
- les secrets GitHub `OVH_APPLICATION_KEY`, `OVH_APPLICATION_SECRET`, `OVH_CONSUMER_KEY`

Le workflow n’upload volontairement **aucun** artifact contenant de plan binaire, d’outputs sensibles ou de `terraform.tfvars` générés.

Après un `apply` réussi, la suite CI/CD naturelle est de déclencher `.github/workflows/terraform-state-backend.yml` pour matérialiser les buckets de state à partir des credentials générées.

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






