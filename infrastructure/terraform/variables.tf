variable "ovh_endpoint" {
  description = "Endpoint OVH API, ex: ovh-eu."
  type        = string
  default     = "ovh-eu"
}

variable "ovh_application_key" {
  description = "OVH application key."
  type        = string
  sensitive   = true
}

variable "ovh_application_secret" {
  description = "OVH application secret."
  type        = string
  sensitive   = true
}

variable "ovh_consumer_key" {
  description = "OVH consumer key."
  type        = string
  sensitive   = true
}

variable "project_name" {
  description = "Nom du projet logique BetLeague."
  type        = string
  default     = "betleague"
}

variable "environment" {
  description = "Nom de l’environnement déployé."
  type        = string
  default     = "prod"
}

variable "service_name" {
  description = "ID du projet OVH Public Cloud."
  type        = string
}

variable "region" {
  description = "Région OVH Public Cloud cible."
  type        = string
}

variable "instance_name" {
  description = "Nom explicite de l’instance. Si null, construit depuis project_name + environment."
  type        = string
  default     = null
}

variable "flavor_id" {
  description = "ID du flavor OVH Public Cloud."
  type        = string
}

variable "image_id" {
  description = "ID de l’image OVH Public Cloud."
  type        = string
}

variable "ssh_key_name" {
  description = "Nom OVH d’une clé SSH déjà présente dans le projet Public Cloud."
  type        = string
  default     = null
}

variable "ssh_key_public_key" {
  description = "Clé publique SSH à importer dans OVH si tu ne veux pas utiliser une clé existante."
  type        = string
  default     = null
}

variable "ssh_authorized_keys" {
  description = "Liste de clés SSH publiques installées par cloud-init."
  type        = list(string)
  default     = []
}

variable "admin_user" {
  description = "Utilisateur d’administration créé sur l’hôte."
  type        = string
  default     = "betleague"
}

variable "billing_period" {
  description = "Période de facturation OVH de l’instance: hourly ou monthly."
  type        = string
  default     = "monthly"
}

variable "private_subnet_cidr" {
  description = "CIDR du réseau privé OVH."
  type        = string
  default     = "10.42.0.0/24"
}

variable "timezone" {
  description = "Fuseau horaire système."
  type        = string
  default     = "Europe/Paris"
}

variable "allowed_tcp_ports" {
  description = "Ports TCP publics ouverts sur l’hôte. Le port 22 n'est autorisé que si enable_public_ssh vaut true."
  type        = list(number)
  default     = [80, 443]
}

variable "enable_public_ssh" {
  description = "Autorise explicitement l’ouverture publique du port SSH 22. Désactivé par défaut pour éviter SSH ouvert au monde."
  type        = bool
  default     = false
}

variable "docker_users" {
  description = "Utilisateurs supplémentaires à ajouter au groupe docker."
  type        = list(string)
  default     = []
}

variable "extra_packages" {
  description = "Paquets supplémentaires à installer au bootstrap."
  type        = list(string)
  default     = []
}

variable "enable_fail2ban" {
  description = "Active fail2ban sur l’hôte."
  type        = bool
  default     = true
}

variable "compose_root" {
  description = "Répertoire de déploiement de BetLeague sur l’hôte."
  type        = string
  default     = "/opt/betleague"
}

variable "create_dns_records" {
  description = "Crée les enregistrements DNS app/api dans la zone OVH."
  type        = bool
  default     = true
}

variable "dns_zone" {
  description = "Zone DNS OVH à gérer, ex: betleague.app."
  type        = string
  default     = "betleague.app"
}

variable "dns_default_ttl" {
  description = "TTL par défaut des enregistrements DNS."
  type        = number
  default     = 300
}

variable "app_subdomain" {
  description = "Sous-domaine frontend."
  type        = string
  default     = "app"
}

variable "api_subdomain" {
  description = "Sous-domaine backend."
  type        = string
  default     = "api"
}


