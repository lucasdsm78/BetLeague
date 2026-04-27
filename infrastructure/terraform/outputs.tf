output "vps_id" {
  description = "ID Terraform de la ressource OVH VPS BetLeague."
  value       = module.vps.id
}

output "vps_service_name" {
  description = "Nom de service OVH du VPS commandé."
  value       = module.vps.service_name
}

output "instance_name" {
  description = "Nom logique du VPS déployé."
  value       = module.vps.instance_name
}

output "instance_public_ipv4" {
  description = "IPv4 publique du VPS."
  value       = module.vps.public_ipv4
}

output "environment" {
  description = "Environnement Terraform déployé."
  value       = var.environment
}

output "admin_user" {
  description = "Utilisateur d’administration créé sur l’hôte."
  value       = var.admin_user
}

output "compose_root" {
  description = "Répertoire racine attendu pour le runtime BetLeague sur l’hôte."
  value       = var.compose_root
}

output "resolved_vps_plan_code" {
  description = "Plan code OVH utilisé pour commander le VPS-3."
  value       = module.vps.plan_code
}

output "dns_record_ids" {
  description = "IDs des enregistrements DNS créés."
  value       = var.create_dns_records ? module.dns[0].record_ids : {}
}

output "ansible_inventory_host" {
  description = "Objet prêt à être transformé en inventaire Ansible pour l’hôte VPS-3."
  value = {
    group                      = "betleague_vps3"
    hostname                   = module.vps.instance_name
    ansible_host               = module.vps.public_ipv4
    ansible_user               = var.admin_user
    betleague_instance_name    = module.vps.instance_name
    betleague_environment      = var.environment
    betleague_compose_root     = var.compose_root
    betleague_vps_service_name = module.vps.service_name
    betleague_vps_plan_code    = module.vps.plan_code
  }
}

