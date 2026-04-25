locals {
  docker_users = distinct(compact(concat([var.admin_user], var.docker_users)))
  packages = distinct(concat([
    "apt-transport-https",
    "ca-certificates",
    "curl",
    "docker-compose-plugin",
    "docker.io",
    "fail2ban",
    "git",
    "jq",
    "ufw",
  ], var.extra_packages))

  user_data = templatefile("${path.module}/templates/cloud-config.yaml.tftpl", {
    hostname            = var.hostname
    admin_user          = var.admin_user
    ssh_authorized_keys = var.ssh_authorized_keys
    timezone            = var.timezone
    packages            = local.packages
    allowed_tcp_ports   = var.allowed_tcp_ports
    docker_users        = local.docker_users
    enable_fail2ban     = var.enable_fail2ban
    compose_root        = var.compose_root
    motd                = trimspace(var.motd)
  })
}

