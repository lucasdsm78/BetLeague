# terraform-ovh-public-instance

Module Terraform pour créer une instance OVH Public Cloud destinée à héberger BetLeague.

## Choix de conception

- module volontairement simple pour rester robuste
- image et flavor passés par **ID** pour éviter une logique de lookup trop couplée
- clé SSH existante référencée par **nom** OVH, ou créée à la volée via `ssh_key_public_key`
- `user_data` cloud-init injecté depuis le module `cloudinit-docker-host`

## Usage

```hcl
module "instance" {
  source = "git::ssh://git@github.com/your-org/terraform-ovh-public-instance.git?ref=v1.0.0"

  service_name    = var.service_name
  instance_name   = "betleague-prod"
  region          = var.region
  flavor_id       = var.flavor_id
  image_id        = var.image_id
  ssh_key_name    = var.ssh_key_name
  billing_period  = "monthly"
  user_data       = module.cloudinit.user_data
}
```

## Outputs

- `instance_id`
- `public_ipv4`
- `public_ipv6`
- `ip_addresses`


