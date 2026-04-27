output "state_dev_user_id" {
  description = "ID OVH du user Object Storage dev."
  value       = try(ovh_cloud_project_user.state["dev"].id, null)
}

output "state_prod_user_id" {
  description = "ID OVH du user Object Storage prod."
  value       = try(ovh_cloud_project_user.state["prod"].id, null)
}

output "state_dev_s3_access_key_id" {
  description = "Access key S3 pour le backend Terraform dev."
  value       = try(ovh_cloud_project_user_s3_credential.state["dev"].access_key_id, null)
  sensitive   = true
}

output "state_dev_s3_secret_access_key" {
  description = "Secret key S3 pour le backend Terraform dev."
  value       = try(ovh_cloud_project_user_s3_credential.state["dev"].secret_access_key, null)
  sensitive   = true
}

output "state_prod_s3_access_key_id" {
  description = "Access key S3 pour le backend Terraform prod."
  value       = try(ovh_cloud_project_user_s3_credential.state["prod"].access_key_id, null)
  sensitive   = true
}

output "state_prod_s3_secret_access_key" {
  description = "Secret key S3 pour le backend Terraform prod."
  value       = try(ovh_cloud_project_user_s3_credential.state["prod"].secret_access_key, null)
  sensitive   = true
}

output "state_backend_bucket_names" {
  description = "Buckets de state attendus par les identités S3."
  value = merge(
    var.enable_dev_state_identity ? { dev = var.bucket_name_dev } : {},
    var.enable_prod_state_identity ? { prod = var.bucket_name_prod } : {},
  )
}

output "state_backend_enabled_environments" {
  description = "Indique quels environnements backend sont activés par state-identities."
  value = {
    dev  = var.enable_dev_state_identity
    prod = var.enable_prod_state_identity
  }
}

output "state_backend_credentials" {
  description = "Credentials S3 des backends dev/prod pour export scripté."
  value = merge(
    var.enable_dev_state_identity ? {
      dev = {
        access_key_id     = ovh_cloud_project_user_s3_credential.state["dev"].access_key_id
        secret_access_key = ovh_cloud_project_user_s3_credential.state["dev"].secret_access_key
        bucket_name       = var.bucket_name_dev
      }
    } : {},
    var.enable_prod_state_identity ? {
      prod = {
        access_key_id     = ovh_cloud_project_user_s3_credential.state["prod"].access_key_id
        secret_access_key = ovh_cloud_project_user_s3_credential.state["prod"].secret_access_key
        bucket_name       = var.bucket_name_prod
      }
    } : {},
  )
  sensitive = true
}


