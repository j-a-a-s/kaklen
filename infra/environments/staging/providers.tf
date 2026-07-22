provider "aws" {
  region = var.aws_region

  skip_credentials_validation = var.offline_validation
  skip_metadata_api_check     = var.offline_validation
  skip_region_validation      = var.offline_validation
  skip_requesting_account_id  = var.offline_validation

  default_tags {
    tags = local.common_tags
  }
}

provider "aws" {
  alias  = "global"
  region = "us-east-1"

  skip_credentials_validation = var.offline_validation
  skip_metadata_api_check     = var.offline_validation
  skip_region_validation      = var.offline_validation
  skip_requesting_account_id  = var.offline_validation

  default_tags {
    tags = local.common_tags
  }
}
