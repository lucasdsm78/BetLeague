locals {
  normalized_records = {
    for key, record in var.records : key => {
      subdomain = record.subdomain
      target    = record.target
      fieldtype = upper(try(record.fieldtype, "A"))
      ttl       = try(record.ttl, var.default_ttl)
    }
  }
}

resource "ovh_domain_zone_record" "this" {
  for_each = local.normalized_records

  zone      = var.zone
  subdomain = each.value.subdomain
  target    = each.value.target
  fieldtype = each.value.fieldtype
  ttl       = each.value.ttl
}


