resource "ovh_cloud_project_instance" "this" {
  service_name   = var.service_name
  name           = var.instance_name
  region         = var.region
  billing_period = var.billing_period
  user_data      = var.user_data

  flavor {
    flavor_id = var.flavor_id
  }

  boot_from {
    image_id = var.image_id
  }

  network {
    public = var.public_network_enabled

    dynamic "private" {
      for_each = var.attach_private_network ? [1] : []

      content {
        ip = var.private_ip

        network {
          id        = var.private_network_id
          subnet_id = var.private_subnet_id
        }
      }
    }
  }

  dynamic "ssh_key" {
    for_each = var.ssh_key_name != null ? [var.ssh_key_name] : []

    content {
      name = ssh_key.value
    }
  }

  dynamic "ssh_key_create" {
    for_each = var.ssh_key_public_key != null ? [1] : []

    content {
      name       = coalesce(var.ssh_key_name, "${var.instance_name}-ssh")
      public_key = var.ssh_key_public_key
    }
  }

  lifecycle {
    precondition {
      condition     = contains(["hourly", "monthly"], var.billing_period)
      error_message = "billing_period doit valoir hourly ou monthly."
    }

    precondition {
      condition     = !(var.ssh_key_name != null && var.ssh_key_public_key != null)
      error_message = "Utilise soit ssh_key_name, soit ssh_key_public_key, mais pas les deux en même temps."
    }

    precondition {
      condition     = var.attach_private_network ? (var.private_network_id != null && var.private_subnet_id != null) : true
      error_message = "private_network_id et private_subnet_id sont requis quand attach_private_network vaut true."
    }
  }
}

locals {
  public_ipv4_candidates = [
    for address in try(ovh_cloud_project_instance.this.addresses, []) : address.ip
    if try(address.version, 0) == 4
  ]

  public_ipv6_candidates = [
    for address in try(ovh_cloud_project_instance.this.addresses, []) : address.ip
    if try(address.version, 0) == 6
  ]
}



