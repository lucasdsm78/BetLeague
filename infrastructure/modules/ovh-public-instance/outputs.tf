output "instance_id" {
  description = "ID de l’instance OVH Public Cloud."
  value       = ovh_cloud_project_instance.this.id
}

output "instance_name" {
  description = "Nom de l’instance OVH Public Cloud."
  value       = ovh_cloud_project_instance.this.name
}

output "public_ipv4" {
  description = "IPv4 publique principale détectée sur l’instance."
  value       = try(one(local.public_ipv4_candidates), null)
}

output "public_ipv6" {
  description = "IPv6 publique principale détectée sur l’instance."
  value       = try(one(local.public_ipv6_candidates), null)
}

output "ip_addresses" {
  description = "Toutes les adresses IP renvoyées par OVH pour l’instance."
  value       = try(ovh_cloud_project_instance.this.addresses, [])
}


