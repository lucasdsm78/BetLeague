locals {
  instance_name = coalesce(var.instance_name, "${var.project_name}-${var.environment}")
  effective_allowed_tcp_ports = distinct(
    concat(
      [for port in var.allowed_tcp_ports : port if port != 22],
      var.enable_public_ssh ? [22] : [],
    )
  )

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
  source = "git::ssh://git@github.com/lucasdsm78/terraform-ovh-private-network.git?ref=ae7f85d7ce752fbdd523032a6d418cb017b3f8af"

  service_name = var.service_name
  region       = var.region
  network_name = "${local.instance_name}-private"
  subnet_cidr  = var.private_subnet_cidr
  dhcp_enabled = true
  no_gateway   = false
}

module "cloudinit" {
  source = "git::ssh://git@github.com/lucasdsm78/terraform-cloudinit-docker-host.git?ref=c1cb04e72382307ec34ea03f986c424ff0986a66"

  hostname            = local.instance_name
  admin_user          = var.admin_user
  ssh_authorized_keys = var.ssh_authorized_keys
  timezone            = var.timezone
  allowed_tcp_ports   = local.effective_allowed_tcp_ports
  docker_users        = var.docker_users
  extra_packages      = var.extra_packages
  enable_fail2ban     = var.enable_fail2ban
  compose_root        = var.compose_root
}

module "instance" {
  source = "git::ssh://git@github.com/lucasdsm78/terraform-ovh-public-instance.git?ref=cb8ba898d1b63fbb8c054f91dad0abfad2b826b1"

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
  source = "git::ssh://git@github.com/lucasdsm78/terraform-ovh-zone-records.git?ref=e42e27c266c9324ea486e3226837286249340b1c"

  zone        = var.dns_zone
  default_ttl = var.dns_default_ttl
  records     = local.dns_records
}





