# terraform-cloudinit-docker-host

Module Terraform qui génère un `user_data` cloud-init durci pour une VM OVH destinée à héberger BetLeague via Docker Compose.

## Ce que prépare le module

- création d’un utilisateur d’administration
- désactivation du login root par mot de passe
- installation de Docker + plugin Compose
- préparation des dossiers `/opt/betleague/*`
- activation de `ufw`
- activation optionnelle de `fail2ban`

## Usage

```hcl
module "cloudinit" {
  source = "git::ssh://git@github.com/your-org/terraform-cloudinit-docker-host.git?ref=v1.0.0"

  hostname            = "betleague-prod"
  admin_user          = "deployer"
  ssh_authorized_keys = [file("~/.ssh/id_ed25519.pub")]
}
```

## Inputs principaux

- `hostname`
- `admin_user`
- `ssh_authorized_keys`
- `allowed_tcp_ports`
- `docker_users`
- `extra_packages`
- `compose_root`

## Outputs

- `user_data`
- `compose_root`
- `admin_user`

