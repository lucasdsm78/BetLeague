# Modules Terraform Git utilisés par `ovh-prod`

## Mapping recommandé

| Ancien module local | Repo GitHub |
|---|---|
| `modules/cloudinit-docker-host` | `terraform-cloudinit-docker-host` |
| `modules/ovh-private-network` | `terraform-ovh-private-network` |
| `modules/ovh-public-instance` | `terraform-ovh-public-instance` |
| `modules/ovh-zone-records` | `terraform-ovh-zone-records` |

## Exemple de source Terraform

Dans `stacks/ovh-prod/main.tf`, les sources ressemblent à :

```hcl
source = "git::ssh://git@github.com/lucasdsm78/terraform-ovh-public-instance.git?ref=v1.0.0"
```

## État actuel de `ovh-prod`

`stacks/ovh-prod` consomme uniquement ces repos Git tagués. Le monorepo ne contient plus de copie locale des modules.

## Règle de maintenance

Si tu modifies un module :

1. publie la nouvelle version dans le repo du module concerné,
2. crée un nouveau tag (`v1.0.1`, `v1.1.0`, ...),
3. mets à jour la `ref` correspondante dans `stacks/ovh-prod/main.tf`.





