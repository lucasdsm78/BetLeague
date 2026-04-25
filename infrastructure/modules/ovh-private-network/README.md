# terraform-ovh-private-network

Module Terraform OVH Public Cloud pour créer un réseau privé + un subnet.

## Usage

```hcl
module "private_network" {
  source       = "git::ssh://git@github.com/your-org/terraform-ovh-private-network.git?ref=v1.0.0"
  service_name = var.service_name
  region       = var.region
  network_name = "betleague-private"
  subnet_cidr  = "10.42.0.0/24"
}
```

## Inputs

- `service_name`
- `region`
- `network_name`
- `subnet_cidr`
- `dhcp_enabled`
- `no_gateway`
- `start_ip`
- `end_ip`

## Outputs

- `network_id`
- `network_name`
- `subnet_id`
- `subnet_cidr`

