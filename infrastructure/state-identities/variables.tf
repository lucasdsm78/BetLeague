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

variable "service_name" {
  description = "ID du projet OVH Public Cloud."
  type        = string
}

variable "bucket_name_dev" {
  description = "Nom du bucket de state Terraform pour dev."
  type        = string
  default     = "betleague-terraform-state-dev"
}

variable "bucket_name_prod" {
  description = "Nom du bucket de state Terraform pour prod."
  type        = string
  default     = "betleague-terraform-state-prod"
}

variable "enable_bucket_scoped_policies" {
  description = "Attache des policies S3 bucket-scoped pour limiter chaque identité à son bucket."
  type        = bool
  default     = true
}

