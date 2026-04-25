# Modules Terraform à publier dans des repos GitHub séparés

## Mapping recommandé

| Module local | Repo GitHub recommandé |
|---|---|
| `modules/cloudinit-docker-host` | `terraform-cloudinit-docker-host` |
| `modules/ovh-private-network` | `terraform-ovh-private-network` |
| `modules/ovh-public-instance` | `terraform-ovh-public-instance` |
| `modules/ovh-zone-records` | `terraform-ovh-zone-records` |

## Publication repo par repo

Depuis la racine du monorepo :

```bash
infrastructure/scripts/publish_module_to_repo.sh cloudinit-docker-host git@github.com:YOUR_ORG/terraform-cloudinit-docker-host.git main
infrastructure/scripts/publish_module_to_repo.sh ovh-private-network git@github.com:YOUR_ORG/terraform-ovh-private-network.git main
infrastructure/scripts/publish_module_to_repo.sh ovh-public-instance git@github.com:YOUR_ORG/terraform-ovh-public-instance.git main
infrastructure/scripts/publish_module_to_repo.sh ovh-zone-records git@github.com:YOUR_ORG/terraform-ovh-zone-records.git main
```

## Publication en une commande

```bash
infrastructure/scripts/publish_all_modules.sh YOUR_ORG main
```

## Après publication

Dans `stacks/ovh-prod`, remplace les `source = "../../modules/..."` par des sources Git versionnées, par exemple :

```hcl
source = "git::ssh://git@github.com/YOUR_ORG/terraform-ovh-public-instance.git?ref=v1.0.0"
```

## État actuel de `ovh-prod`

Actuellement, `stacks/ovh-prod` reste branchée sur les modules locaux pour rester validable immédiatement.

La bascule prête à l’emploi vers les **URLs Git des repos dédiés** est documentée dans `stacks/ovh-prod/git-module-sources.example.txt`.




