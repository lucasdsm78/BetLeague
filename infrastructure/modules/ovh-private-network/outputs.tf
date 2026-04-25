output "network_id" {
  description = "ID du réseau privé OVH."
  value       = ovh_cloud_project_network_private.this.id
}

output "network_name" {
  description = "Nom du réseau privé OVH."
  value       = ovh_cloud_project_network_private.this.name
}

output "subnet_id" {
  description = "ID du subnet OVH."
  value       = ovh_cloud_project_network_private_subnet.this.id
}

output "subnet_cidr" {
  description = "CIDR du subnet privé."
  value       = var.subnet_cidr
}

