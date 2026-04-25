locals {
  instance_name = coalesce(var.instance_name, "${var.project_name}-${var.environment}")

  dns_records = var.create_dns_records ? {
    app = {
      subdomain = var.app_subdomain
      target    = module.instance.public_ipv4
      fieldtype = "A"
      ttl       = var.dns_default_ttl
    }
    api = {
      subdomain = var.api_subdomain
      target    = module.instance.public_ipv4
      fieldtype = "A"
      ttl       = var.dns_default_ttl
    }
  } : {}
}

module "private_network" {
  source = "../../modules/ovh-private-network"

  service_name = var.service_name
  region       = var.region
  network_name = "${local.instance_name}-private"
  subnet_cidr  = var.private_subnet_cidr
  dhcp_enabled = true
  no_gateway   = false
}

module "cloudinit" {
  source = "../../modules/cloudinit-docker-host"

  hostname            = local.instance_name
  admin_user          = var.admin_user
  ssh_authorized_keys = var.ssh_authorized_keys
  timezone            = var.timezone
  allowed_tcp_ports   = var.allowed_tcp_ports
  docker_users        = var.docker_users
  extra_packages      = var.extra_packages
  enable_fail2ban     = var.enable_fail2ban
  compose_root        = var.compose_root
}

module "instance" {
  source = "../../modules/ovh-public-instance"

  service_name           = var.service_name
  instance_name          = local.instance_name
  region                 = var.region
  flavor_id              = var.flavor_id
  image_id               = var.image_id
  billing_period         = var.billing_period
  ssh_key_name           = var.ssh_key_name
  ssh_key_public_key     = var.ssh_key_public_key
  public_network_enabled = true
  attach_private_network = true
  private_network_id     = module.private_network.network_id
  private_subnet_id      = module.private_network.subnet_id
  user_data              = module.cloudinit.user_data
}

module "dns" {
  count  = var.create_dns_records ? 1 : 0
  source = "../../modules/ovh-zone-records"

  zone        = var.dns_zone
  default_ttl = var.dns_default_ttl
  records     = local.dns_records
}





