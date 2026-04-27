resource "aws_s3_bucket" "terraform_state_dev" {
  count    = var.enable_dev_bucket ? 1 : 0
  provider = aws.dev
  bucket   = var.bucket_name_dev

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state_dev" {
  count    = var.enable_dev_bucket && var.enable_public_access_block ? 1 : 0
  provider = aws.dev
  bucket   = aws_s3_bucket.terraform_state_dev[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "terraform_state_dev" {
  count    = var.enable_dev_bucket ? 1 : 0
  provider = aws.dev
  bucket   = aws_s3_bucket.terraform_state_dev[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state_dev" {
  count    = var.enable_dev_bucket ? 1 : 0
  provider = aws.dev
  bucket   = aws_s3_bucket.terraform_state_dev[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "terraform_state_dev" {
  count    = var.enable_dev_bucket ? 1 : 0
  provider = aws.dev
  bucket   = aws_s3_bucket.terraform_state_dev[0].id

  rule {
    id     = "retain-noncurrent-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

resource "aws_s3_bucket" "terraform_state_prod" {
  count    = var.enable_prod_bucket ? 1 : 0
  provider = aws.prod
  bucket   = var.bucket_name_prod

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state_prod" {
  count    = var.enable_prod_bucket && var.enable_public_access_block ? 1 : 0
  provider = aws.prod
  bucket   = aws_s3_bucket.terraform_state_prod[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "terraform_state_prod" {
  count    = var.enable_prod_bucket ? 1 : 0
  provider = aws.prod
  bucket   = aws_s3_bucket.terraform_state_prod[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state_prod" {
  count    = var.enable_prod_bucket ? 1 : 0
  provider = aws.prod
  bucket   = aws_s3_bucket.terraform_state_prod[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "terraform_state_prod" {
  count    = var.enable_prod_bucket ? 1 : 0
  provider = aws.prod
  bucket   = aws_s3_bucket.terraform_state_prod[0].id

  rule {
    id     = "retain-noncurrent-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}





