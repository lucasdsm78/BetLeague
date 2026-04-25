variable "service_name" {
  description = "ID du projet OVH Public Cloud."
  type        = string
}

variable "region" {
  description = "Région OVH Public Cloud où créer le réseau privé."
  type        = string
}

variable "network_name" {
  description = "Nom lisible du réseau privé OVH."
  type        = string
}

variable "subnet_cidr" {
  description = "CIDR du subnet privé."
  type        = string

  validation {
    condition     = can(cidrhost(var.subnet_cidr, 10))
    error_message = "subnet_cidr doit être un CIDR IPv4 valide, ex: 10.42.0.0/24."
  }
}

variable "dhcp_enabled" {
  description = "Active le DHCP OVH sur le subnet."
  type        = bool
  default     = true
}

variable "no_gateway" {
  description = "Désactive la gateway OVH sur le subnet si true."
  type        = bool
  default     = false
}

variable "start_ip" {
  description = "Première IP du pool DHCP. Si null, calculée automatiquement."
  type        = string
  default     = null
}

variable "end_ip" {
  description = "Dernière IP du pool DHCP. Si null, calculée automatiquement."
  type        = string
  default     = null
}

