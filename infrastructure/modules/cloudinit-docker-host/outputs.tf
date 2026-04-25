output "user_data" {
  description = "Payload cloud-init rendu pour l’instance OVH."
  value       = local.user_data
  sensitive   = true
}

output "compose_root" {
  description = "Répertoire racine préparé sur l’hôte pour BetLeague."
  value       = var.compose_root
}

output "admin_user" {
  description = "Utilisateur d’administration créé par cloud-init."
  value       = var.admin_user
}

