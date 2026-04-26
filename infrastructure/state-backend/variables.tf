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

variable "bucket_name_dev" {
  type        = string
  description = "Nom du bucket de state Terraform pour l’environnement dev."
  default     = "betleague-terraform-state-dev"
}

variable "bucket_name_prod" {
  type        = string
  description = "Nom du bucket de state Terraform pour l’environnement prod."
  default     = "betleague-terraform-state-prod"
}

variable "access_key_id_dev" {
  type        = string
  description = "Access key OVH Object Storage pour le bucket dev."
  sensitive   = true
}

variable "secret_access_key_dev" {
  type        = string
  description = "Secret key OVH Object Storage pour le bucket dev."
  sensitive   = true
}

variable "access_key_id_prod" {
  type        = string
  description = "Access key OVH Object Storage pour le bucket prod."
  sensitive   = true
}

variable "secret_access_key_prod" {
  type        = string
  description = "Secret key OVH Object Storage pour le bucket prod."
  sensitive   = true
}


