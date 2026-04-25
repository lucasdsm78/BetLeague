# Infrastructure Terraform OVH - BetLeague

Cette arborescence contient une base Terraform modulaire pour déployer une infrastructure BetLeague sur OVH Public Cloud avec une approche simple, rapide et sécurisée.

## Architecture cible

- **1 instance publique OVH Public Cloud** durcie via `cloud-init`
- **1 réseau privé OVH** pour les communications internes futures
- **DNS OVH** pour `app` / `api`
- **Base PostgreSQL managée externe** recommandée (ex: Neon), volontairement hors Terraform ici
- **Secrets runtime hors Terraform** (fichiers montés en lecture seule sur le serveur)

## Modules fournis

- `modules/ovh-private-network`
- `modules/cloudinit-docker-host`
- `modules/ovh-public-instance`
- `modules/ovh-zone-records`

Chaque module est **self-contained** pour être publié dans un repo Git distinct.

## Stack fournie

- `stacks/ovh-prod`

Par défaut, la stack référence les modules en **local** pour accélérer le bootstrap. Une fois les modules publiés, remplace les `source = "../../modules/..."` par des sources Git :

```hcl
source = "git::ssh://git@github.com/your-org/terraform-ovh-public-instance.git?ref=v1.0.0"
```

## Pré-requis

- Terraform >= 1.5
- Un projet OVH Public Cloud
- Un domaine OVH si tu veux gérer le DNS via Terraform
- Variables OVH exportées dans le shell :

```bash
export OVH_ENDPOINT="ovh-eu"
export OVH_APPLICATION_KEY="..."
export OVH_APPLICATION_SECRET="..."
export OVH_CONSUMER_KEY="..."
```

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

## Publication de chaque module dans un repo GitHub séparé

Un script est fourni :

```bash
infrastructure/scripts/publish_module_to_repo.sh ovh-private-network git@github.com:your-org/terraform-ovh-private-network.git
```

Le script utilise `git subtree split` pour extraire l'historique du module et le pousser vers un dépôt Git distant.

Pour publier tous les modules d'un coup dans des repos GitHub distincts :

```bash
infrastructure/scripts/publish_all_modules.sh your-org-or-user main
```

Puis, pour basculer automatiquement `stacks/ovh-prod/main.tf` vers les URLs Git des repos modules :

```bash
infrastructure/scripts/switch_ovh_prod_to_git_modules.sh your-org-or-user v1.0.0
```

Ou vers le monorepo BetLeague lui-même :

```bash
infrastructure/scripts/switch_ovh_prod_to_git_modules.sh https://github.com/lucasdsm78/BetLeague dev
```

Cela poussera automatiquement vers :

- `terraform-cloudinit-docker-host`
- `terraform-ovh-private-network`
- `terraform-ovh-public-instance`
- `terraform-ovh-zone-records`

## Démarrage rapide

```bash
cd infrastructure/stacks/ovh-prod
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
```

## Ordre recommandé

1. Publier les modules dans leurs repos GitHub dédiés
2. Remplacer les `source` locaux de la stack par des `source` Git versionnées
3. Déployer la stack `ovh-prod`
4. Déployer l'application (Docker Compose ou systemd) sur l'instance
5. Injecter les secrets runtime hors Terraform

## Structure livrée

```text
infrastructure/
├── modules/
│   ├── cloudinit-docker-host/
│   ├── ovh-private-network/
│   ├── ovh-public-instance/
│   └── ovh-zone-records/
├── scripts/
│   ├── publish_module_to_repo.sh
│   └── publish_all_modules.sh
└── stacks/
	└── ovh-prod/
```

