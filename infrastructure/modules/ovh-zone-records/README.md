# terraform-ovh-zone-records

Module Terraform pour gérer des enregistrements DNS dans une zone OVH.

## Cas d’usage BetLeague

Ce module sert typiquement à publier :

- `app.betleague.app` vers le frontend
- `api.betleague.app` vers le backend

## Usage

```hcl
module "dns" {
  source = "git::ssh://git@github.com/your-org/terraform-ovh-zone-records.git?ref=v1.0.0"

  zone = "betleague.app"
  records = {
    app = {
      subdomain = "app"
      target    = "203.0.113.10"
      fieldtype = "A"
    }
    api = {
      subdomain = "api"
      target    = "203.0.113.10"
      fieldtype = "A"
    }
  }
}
```

## Inputs

- `zone`
- `default_ttl`
- `records`

## Outputs

- `record_ids`
- `records`

