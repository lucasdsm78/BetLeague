terraform {
  required_version = "~> 1.14.0"

  required_providers {
    ovh = {
      source  = "ovh/ovh"
      version = "~> 2.13.0"
    }
  }
}

provider "ovh" {
  endpoint           = var.ovh_endpoint
  application_key    = var.ovh_application_key
  application_secret = var.ovh_application_secret
  consumer_key       = var.ovh_consumer_key
}

