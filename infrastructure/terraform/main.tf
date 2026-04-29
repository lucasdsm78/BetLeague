locals {
  normalized_vps_offer_type = (
    var.vps_offer_type == null || trimspace(var.vps_offer_type) == ""
  ) ? null : trimspace(var.vps_offer_type)

  normalized_existing_vps_service_name = (
    var.existing_vps_service_name == null || trimspace(var.existing_vps_service_name) == ""
  ) ? null : trimspace(var.existing_vps_service_name)

  manage_vps = local.normalized_existing_vps_service_name == null

  desired_instance_name = coalesce(var.vps_name, "${var.project_name}-${var.environment}")

  existing_vps_ips = local.manage_vps ? [] : try(tolist(lookup(data.ovh_vps.existing[0], "ips", [])), [])
  existing_vps_public_ipv4 = local.manage_vps ? null : try(
    [for ip in local.existing_vps_ips : ip if can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}$", ip))][0],
    null
  )

  vps_id           = local.manage_vps ? module.vps[0].id : lookup(data.ovh_vps.existing[0], "service_name", null)
  vps_service_name = local.manage_vps ? module.vps[0].service_name : lookup(data.ovh_vps.existing[0], "service_name", null)
  vps_instance_name = local.manage_vps ? module.vps[0].instance_name : local.desired_instance_name
  vps_public_ipv4   = local.manage_vps ? module.vps[0].public_ipv4 : local.existing_vps_public_ipv4

  dns_records = var.create_dns_records ? {
    app = {
      subdomain = var.app_subdomain
      target    = local.vps_public_ipv4
      fieldtype = "A"
      ttl       = var.dns_default_ttl
    }
    api = {
      subdomain = var.api_subdomain
      target    = local.vps_public_ipv4
      fieldtype = "A"
      ttl       = var.dns_default_ttl
    }
  } : {}
}

data "ovh_vps" "existing" {
  count = local.manage_vps ? 0 : 1

  service_name = local.normalized_existing_vps_service_name
}

module "vps" {
  count  = local.manage_vps ? 1 : 0
  source = "git::ssh://git@github.com/lucasdsm78/terraform-ovh-vps.git?ref=77b9de6783fb63f88f5f8aac82bfadb54af996d7"

  project_name       = var.project_name
  environment        = var.environment
  vps_name           = var.vps_name
  vps_display_name   = var.vps_display_name
  ovh_subsidiary     = var.ovh_subsidiary
  vps_zone           = var.vps_zone
  vps_offer_type     = local.normalized_vps_offer_type
  vps_plan_code      = var.vps_plan_code
  vps_pricing_mode   = var.vps_pricing_mode
  vps_duration       = var.vps_duration
  vps_image_id       = var.vps_image_id
  vps_public_ssh_key = var.vps_public_ssh_key
}

module "dns" {
  count  = var.create_dns_records ? 1 : 0
  source = "git::ssh://git@github.com/lucasdsm78/terraform-ovh-zone-records.git?ref=e42e27c266c9324ea486e3226837286249340b1c"

  zone        = var.dns_zone
  default_ttl = var.dns_default_ttl
  records     = local.dns_records
}





