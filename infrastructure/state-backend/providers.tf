terraform {
  required_version = "~> 1.14.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  alias                       = "dev"
  region                      = var.region
  access_key                  = var.access_key_id_dev
  secret_key                  = var.secret_access_key_dev
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_region_validation      = true
  skip_requesting_account_id  = true

  endpoints {
    s3 = var.s3_endpoint
  }
}

provider "aws" {
  alias                       = "prod"
  region                      = var.region
  access_key                  = var.access_key_id_prod
  secret_key                  = var.secret_access_key_prod
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_region_validation      = true
  skip_requesting_account_id  = true

  endpoints {
    s3 = var.s3_endpoint
  }
}


