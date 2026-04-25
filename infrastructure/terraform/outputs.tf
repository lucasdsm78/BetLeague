output "instance_id" {
  description = "ID de l’instance OVH BetLeague."
  value       = module.instance.instance_id
}

output "instance_public_ipv4" {
  description = "IPv4 publique de l’instance."
  value       = module.instance.public_ipv4
}

output "private_network_id" {
  description = "ID du réseau privé OVH créé pour l’environnement."
  value       = module.private_network.network_id
}

output "private_subnet_id" {
  description = "ID du subnet privé OVH."
  value       = module.private_network.subnet_id
}

output "dns_record_ids" {
  description = "IDs des enregistrements DNS créés."
  value       = var.create_dns_records ? module.dns[0].record_ids : {}
}

