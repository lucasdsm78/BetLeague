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

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.environment))
    error_message = "environment doit contenir uniquement des lettres minuscules, chiffres et tirets."
  }
}

variable "vps_name" {
  description = "Nom explicite du VPS. Si null, construit depuis project_name + environment."
  type        = string
  default     = null
}

variable "vps_display_name" {
  description = "Nom d’affichage du VPS dans OVH Manager."
  type        = string
  default     = null
}

variable "ovh_subsidiary" {
  description = "Filiale OVH utilisée pour la commande VPS, ex: FR."
  type        = string
  default     = "FR"

  validation {
    condition     = can(regex("^[A-Z]{2}$", var.ovh_subsidiary))
    error_message = "ovh_subsidiary doit être un code pays OVH en majuscules, ex: FR."
  }
}

variable "vps_zone" {
  description = "Zone/datacenter OVH cible pour le VPS, ex: RBX ou GRA."
  type        = string

  validation {
    condition     = can(regex("^[A-Za-z0-9-]+$", var.vps_zone))
    error_message = "vps_zone doit être une zone OVH valide."
  }
}

variable "vps_offer_type" {
  description = "Type d’offre OVH VPS. Facultatif : laisse OVH/provider déterminer la valeur si null."
  type        = string
  default     = null
}

variable "vps_plan_code" {
  description = "Plan code OVH de l’offre VPS à commander. Il doit correspondre à une offre VPS-3 historique ou au modèle 3 de la gamme VPS 2025."
  type        = string
  default     = "vps-3"

  validation {
    condition     = strcontains(lower(var.vps_plan_code), "vps-3") || strcontains(lower(var.vps_plan_code), "model3")
    error_message = "vps_plan_code doit correspondre à une offre VPS-3 historique ou au modèle 3 de la gamme VPS 2025."
  }
}

variable "vps_pricing_mode" {
  description = "Mode de pricing OVH pour la commande du VPS."
  type        = string
  default     = "default"
}

variable "vps_duration" {
  description = "Durée de souscription OVH pour la commande VPS, ex: P1M ou P1Y suivant le catalogue."
  type        = string
  default     = "P1M"

  validation {
    condition     = can(regex("^P[0-9]+[MY]$", var.vps_duration))
    error_message = "vps_duration doit suivre un format de type P1M ou P1Y."
  }
}

variable "vps_image_id" {
  description = "Image/template OVH à installer sur le VPS."
  type        = string
}

variable "vps_public_ssh_key" {
  description = "Clé publique SSH injectée par OVH au provisioning initial du VPS."
  type        = string

  validation {
    condition     = can(regex("^(ssh-(ed25519|rsa)|ecdsa-sha2-nistp(256|384|521))\\s+", var.vps_public_ssh_key))
    error_message = "vps_public_ssh_key doit être une clé SSH publique valide."
  }
}

variable "admin_user" {
  description = "Utilisateur d’administration créé sur l’hôte."
  type        = string
  default     = "betleague"

  validation {
    condition     = can(regex("^[a-z_][a-z0-9_-]{0,31}$", var.admin_user))
    error_message = "admin_user doit être un nom d’utilisateur Linux valide."
  }
}

variable "compose_root" {
  description = "Répertoire de déploiement de BetLeague sur l’hôte."
  type        = string
  default     = "/opt/betleague"

  validation {
    condition     = startswith(var.compose_root, "/")
    error_message = "compose_root doit être un chemin absolu."
  }
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

  validation {
    condition     = var.dns_default_ttl >= 60 && var.dns_default_ttl <= 86400
    error_message = "dns_default_ttl doit être compris entre 60 et 86400 secondes."
  }
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


