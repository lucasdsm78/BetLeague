locals {
  subnet_start = coalesce(var.start_ip, cidrhost(var.subnet_cidr, 10))
  subnet_end   = coalesce(var.end_ip, cidrhost(var.subnet_cidr, 200))
}

resource "ovh_cloud_project_network_private" "this" {
  service_name = var.service_name
  name         = var.network_name
  regions      = [var.region]
}

resource "ovh_cloud_project_network_private_subnet" "this" {
  service_name = var.service_name
  network_id   = ovh_cloud_project_network_private.this.id
  region       = var.region
  network      = var.subnet_cidr
  start        = local.subnet_start
  end          = local.subnet_end
  dhcp         = var.dhcp_enabled
  no_gateway   = var.no_gateway
}

