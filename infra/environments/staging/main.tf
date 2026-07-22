module "networking" {
  source = "../../modules/networking"

  name_prefix          = local.name_prefix
  vpc_cidr             = var.vpc_cidr
  availability_zones   = var.availability_zones
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  enable_nat_gateway   = var.enable_nat_gateway
  single_nat_gateway   = var.single_nat_gateway
  tags                 = local.common_tags
}

module "security" {
  source = "../../modules/security"

  name_prefix                 = local.name_prefix
  aws_region                  = var.aws_region
  vpc_id                      = module.networking.vpc_id
  vpc_cidr                    = module.networking.vpc_cidr
  private_subnet_ids          = module.networking.private_subnet_ids
  private_route_table_ids     = module.networking.private_route_table_ids
  api_port                    = var.api_port
  smtp_port                   = var.mail_port
  smtp_egress_cidrs           = var.smtp_egress_cidrs
  approved_https_egress_cidrs = var.approved_https_egress_cidrs
  tags                        = local.common_tags
}

module "load_balancer" {
  source = "../../modules/load-balancer"

  name_prefix                = local.name_prefix
  vpc_id                     = module.networking.vpc_id
  public_subnet_ids          = module.networking.public_subnet_ids
  security_group_id          = module.security.alb_security_group_id
  target_port                = var.api_port
  health_check_path          = "/api/health/live"
  certificate_arn            = var.alb_certificate_arn
  enable_deletion_protection = var.alb_deletion_protection
  tags                       = local.common_tags
}

module "storage" {
  source = "../../modules/storage"

  providers = {
    aws        = aws
    aws.global = aws.global
  }

  name_prefix                      = local.name_prefix
  application_bucket_name          = var.application_bucket_name
  web_bucket_name                  = var.web_bucket_name
  versioning_enabled               = var.storage_versioning_enabled
  lifecycle_enabled                = var.storage_lifecycle_enabled
  application_cors_allowed_origins = [var.app_public_url]
  cloudfront_aliases               = var.cloudfront_aliases
  cloudfront_certificate_arn       = var.cloudfront_certificate_arn
  price_class                      = var.cloudfront_price_class
  tags                             = local.common_tags
}

module "secrets" {
  source = "../../modules/secrets"

  name_prefix = local.name_prefix
  secrets     = local.application_secret_descriptions
  tags        = local.common_tags
}

module "rds" {
  source = "../../modules/rds"

  name_prefix                  = local.name_prefix
  private_subnet_ids           = module.networking.private_subnet_ids
  security_group_id            = module.security.rds_security_group_id
  database_name                = var.database_name
  master_username              = var.database_master_username
  instance_class               = var.database_instance_class
  allocated_storage_gib        = var.database_allocated_storage_gib
  max_allocated_storage_gib    = var.database_max_allocated_storage_gib
  backup_retention_days        = var.database_backup_retention_days
  deletion_protection          = var.database_deletion_protection
  performance_insights_enabled = var.database_performance_insights_enabled
  multi_az                     = var.database_multi_az
  skip_final_snapshot          = false
  tags                         = local.common_tags
}

module "redis" {
  source = "../../modules/redis"

  name_prefix              = local.name_prefix
  private_subnet_ids       = module.networking.private_subnet_ids
  security_group_id        = module.security.redis_security_group_id
  node_type                = var.redis_node_type
  num_cache_clusters       = var.redis_num_cache_clusters
  auth_token               = var.redis_auth_token
  snapshot_retention_limit = 3
  tags                     = local.common_tags
}

module "ecs" {
  source = "../../modules/ecs"

  name_prefix              = local.name_prefix
  aws_region               = var.aws_region
  api_image                = var.api_image
  api_ecr_repository_arn   = var.api_ecr_repository_arn
  private_subnet_ids       = module.networking.private_subnet_ids
  security_group_id        = module.security.ecs_security_group_id
  target_group_arn         = module.load_balancer.target_group_arn
  application_bucket_arn   = module.storage.application_bucket_arn
  application_kms_key_arn  = module.storage.application_kms_key_arn
  environment              = local.api_environment
  secrets                  = module.secrets.secret_arns
  container_port           = var.api_port
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  desired_count            = var.api_desired_count
  enable_service           = var.enable_ecs_service
  enable_autoscaling       = var.enable_ecs_autoscaling
  autoscaling_min_capacity = var.ecs_min_capacity
  autoscaling_max_capacity = var.ecs_max_capacity
  log_retention_days       = var.log_retention_days
  tags                     = local.common_tags
}

module "observability" {
  source = "../../modules/observability"

  name_prefix             = local.name_prefix
  ecs_cluster_name        = module.ecs.cluster_name
  ecs_service_name        = module.ecs.service_name
  alb_arn_suffix          = module.load_balancer.arn_suffix
  target_group_arn_suffix = module.load_balancer.target_group_arn_suffix
  rds_instance_id         = module.rds.instance_id
  enable_sns_alerts       = var.enable_sns_alerts
  tags                    = local.common_tags
}
