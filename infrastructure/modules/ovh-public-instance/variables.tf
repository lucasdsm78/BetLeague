variable "service_name" {
  description = "ID du projet OVH Public Cloud."
  type        = string
}

variable "instance_name" {
  description = "Nom de l’instance OVH Public Cloud."
  type        = string
}

variable "region" {
  description = "Région OVH Public Cloud de l’instance."
  type        = string
}

variable "flavor_id" {
  description = "ID du flavor OVH Public Cloud."
  type        = string
}

variable "image_id" {
  description = "ID de l’image OVH Public Cloud."
  type        = string
}

variable "billing_period" {
  description = "Période de facturation OVH Public Cloud: hourly ou monthly."
  type        = string
  default     = "monthly"
}

variable "ssh_key_name" {
  description = "Nom d’une clé SSH déjà présente dans le projet OVH."
  type        = string
  default     = null
}

variable "ssh_key_public_key" {
  description = "Clé publique SSH à importer dans OVH au moment de la création si besoin."
  type        = string
  default     = null
}

variable "public_network_enabled" {
  description = "Expose l’instance sur le réseau public OVH."
  type        = bool
  default     = true
}

variable "attach_private_network" {
  description = "Attache l’instance au réseau privé OVH fourni."
  type        = bool
  default     = false
}

variable "private_network_id" {
  description = "ID du réseau privé OVH à attacher."
  type        = string
  default     = null
}

variable "private_subnet_id" {
  description = "ID du subnet privé OVH à attacher."
  type        = string
  default     = null
}

variable "private_ip" {
  description = "IP privée statique optionnelle de l’instance sur le subnet OVH."
  type        = string
  default     = null
}

variable "user_data" {
  description = "Cloud-init user_data transmis à l’instance."
  type        = string
  default     = null
}


