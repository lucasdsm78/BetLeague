locals {
  state_identities = merge(
    var.enable_dev_state_identity ? {
      dev = {
        description = "Terraform state backend operator (dev)"
        bucket_name = var.bucket_name_dev
      }
    } : {},
    var.enable_prod_state_identity ? {
      prod = {
        description = "Terraform state backend operator (prod)"
        bucket_name = var.bucket_name_prod
      }
    } : {},
  )
}

resource "ovh_cloud_project_user" "state" {
  for_each = local.state_identities

  service_name = var.service_name
  description  = each.value.description
  role_name    = "objectstore_operator"
}

resource "ovh_cloud_project_user_s3_credential" "state" {
  for_each = local.state_identities

  service_name = var.service_name
  user_id      = ovh_cloud_project_user.state[each.key].id
}

resource "ovh_cloud_project_user_s3_policy" "state" {
  for_each = var.enable_bucket_scoped_policies ? local.state_identities : {}

  service_name = var.service_name
  user_id      = ovh_cloud_project_user.state[each.key].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:*",
        ]
        Resource = [
          "arn:aws:s3:::${each.value.bucket_name}",
          "arn:aws:s3:::${each.value.bucket_name}/*",
        ]
      },
    ]
  })
}


