variable "zone" {
  description = "Zone DNS OVH à gérer, ex: betleague.app."
  type        = string
}

variable "default_ttl" {
  description = "TTL par défaut appliqué aux enregistrements si non précisé."
  type        = number
  default     = 300
}

variable "records" {
  description = "Map d’enregistrements DNS OVH à créer."
  type = map(object({
    subdomain = string
    target    = string
    fieldtype = optional(string)
    ttl       = optional(number)
  }))
  default = {}
}

