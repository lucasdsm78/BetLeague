# Modules Terraform Git utilisés par `terraform/`

## Mapping recommandé

| Ancien module local | Repo GitHub |
|---|---|
| `modules/cloudinit-docker-host` | `terraform-cloudinit-docker-host` |
| `modules/ovh-private-network` | `terraform-ovh-private-network` |
| `modules/ovh-public-instance` | `terraform-ovh-public-instance` |
| `modules/ovh-vps` | `terraform-ovh-vps` |
| `modules/ovh-zone-records` | `terraform-ovh-zone-records` |

## Exemple de source Terraform

Dans `terraform/main.tf`, les sources ressemblent à :

```hcl
source = "git::ssh://git@github.com/lucasdsm78/terraform-ovh-public-instance.git?ref=cb8ba898d1b63fbb8c054f91dad0abfad2b826b1"
```

Pour le module VPS :

```hcl
source = "git::ssh://git@github.com/lucasdsm78/terraform-ovh-vps.git?ref=b2edc34ccaf5dbc76ffe87e75eaefc934a99c4bc"
```

## État actuel de `terraform/`

`terraform/` consomme uniquement ces repos Git tagués. Le monorepo ne contient plus de copie locale des modules.

## Règle de maintenance

Si tu modifies un module :

1. publie la nouvelle version dans le repo du module concerné,
2. récupère le SHA du commit à promouvoir,
3. mets à jour la `ref` correspondante dans `terraform/main.tf`.










