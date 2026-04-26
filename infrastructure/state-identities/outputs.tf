output "state_dev_user_id" {
  description = "ID OVH du user Object Storage dev."
  value       = ovh_cloud_project_user.state["dev"].id
}

output "state_prod_user_id" {
  description = "ID OVH du user Object Storage prod."
  value       = ovh_cloud_project_user.state["prod"].id
}

output "state_dev_s3_access_key_id" {
  description = "Access key S3 pour le backend Terraform dev."
  value       = ovh_cloud_project_user_s3_credential.state["dev"].access_key_id
  sensitive   = true
}

output "state_dev_s3_secret_access_key" {
  description = "Secret key S3 pour le backend Terraform dev."
  value       = ovh_cloud_project_user_s3_credential.state["dev"].secret_access_key
  sensitive   = true
}

output "state_prod_s3_access_key_id" {
  description = "Access key S3 pour le backend Terraform prod."
  value       = ovh_cloud_project_user_s3_credential.state["prod"].access_key_id
  sensitive   = true
}

output "state_prod_s3_secret_access_key" {
  description = "Secret key S3 pour le backend Terraform prod."
  value       = ovh_cloud_project_user_s3_credential.state["prod"].secret_access_key
  sensitive   = true
}

output "state_backend_bucket_names" {
  description = "Buckets de state attendus par les identités S3."
  value = {
    dev  = var.bucket_name_dev
    prod = var.bucket_name_prod
  }
}

output "state_backend_credentials" {
  description = "Credentials S3 des backends dev/prod pour export scripté."
  value = {
    dev = {
      access_key_id     = ovh_cloud_project_user_s3_credential.state["dev"].access_key_id
      secret_access_key = ovh_cloud_project_user_s3_credential.state["dev"].secret_access_key
      bucket_name       = var.bucket_name_dev
    }
    prod = {
      access_key_id     = ovh_cloud_project_user_s3_credential.state["prod"].access_key_id
      secret_access_key = ovh_cloud_project_user_s3_credential.state["prod"].secret_access_key
      bucket_name       = var.bucket_name_prod
    }
  }
  sensitive = true
}

