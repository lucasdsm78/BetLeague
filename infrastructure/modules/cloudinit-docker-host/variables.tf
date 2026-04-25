variable "hostname" {
  description = "Hostname système de l’instance Docker host."
  type        = string
}

variable "admin_user" {
  description = "Utilisateur d’administration créé par cloud-init."
  type        = string
  default     = "betleague"
}

variable "ssh_authorized_keys" {
  description = "Clés SSH publiques autorisées sur l’utilisateur d’administration."
  type        = list(string)
  default     = []
}

variable "timezone" {
  description = "Fuseau horaire système."
  type        = string
  default     = "Europe/Paris"
}

variable "allowed_tcp_ports" {
  description = "Liste des ports TCP ouverts via UFW."
  type        = list(number)
  default     = [22, 80, 443]
}

variable "docker_users" {
  description = "Utilisateurs supplémentaires à ajouter au groupe docker."
  type        = list(string)
  default     = []
}

variable "extra_packages" {
  description = "Paquets système additionnels à installer au bootstrap."
  type        = list(string)
  default     = []
}

variable "enable_fail2ban" {
  description = "Active fail2ban sur l’hôte."
  type        = bool
  default     = true
}

variable "compose_root" {
  description = "Répertoire racine applicatif préparé sur l’hôte."
  type        = string
  default     = "/opt/betleague"
}

variable "motd" {
  description = "Message MOTD affiché à la connexion SSH."
  type        = string
  default     = <<-EOT
    BetLeague OVH host ready.
    Déploie l’application via Docker Compose dans /opt/betleague.
  EOT
}

