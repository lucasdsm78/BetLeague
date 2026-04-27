variable "region" {
  type        = string
  description = "Région S3-compatible OVH."
  default     = "gra"
}

variable "s3_endpoint" {
  type        = string
  description = "Endpoint S3 OVH Object Storage."
  default     = "https://s3.gra.io.cloud.ovh.net"
}

variable "enable_public_access_block" {
  type        = bool
  description = "Active aws_s3_bucket_public_access_block si l'API S3 cible le supporte de manière fiable. Désactivé par défaut sur OVH Object Storage."
  default     = false
}

variable "bucket_name_dev" {
  type        = string
  description = "Nom du bucket de state Terraform pour l’environnement dev."
  default     = "betleague-terraform-state-dev"
}

variable "enable_dev_bucket" {
  type        = bool
  description = "Crée temporairement le bucket de state dev si true."
  default     = false
}

variable "bucket_name_prod" {
  type        = string
  description = "Nom du bucket de state Terraform pour l’environnement prod."
  default     = "betleague-terraform-state-prod"
}

variable "enable_prod_bucket" {
  type        = bool
  description = "Crée le bucket de state prod si true."
  default     = true
}

variable "access_key_id_dev" {
  type        = string
  description = "Access key OVH Object Storage pour le bucket dev."
  default     = null
  sensitive   = true
}

variable "secret_access_key_dev" {
  type        = string
  description = "Secret key OVH Object Storage pour le bucket dev."
  default     = null
  sensitive   = true
}

variable "access_key_id_prod" {
  type        = string
  description = "Access key OVH Object Storage pour le bucket prod."
  default     = null
  sensitive   = true
}

variable "secret_access_key_prod" {
  type        = string
  description = "Secret key OVH Object Storage pour le bucket prod."
  default     = null
  sensitive   = true
}




