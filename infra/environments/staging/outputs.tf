output "vpc_id" {
  description = "Staging VPC identifier."
  value       = module.networking.vpc_id
}

output "api_base_url" {
  description = "Configured public HTTPS API base URL."
  value       = "${trimsuffix(var.api_public_url, "/")}/api"
}

output "alb_dns_name" {
  description = "Technical ALB hostname used as the DNS alias target."
  value       = module.load_balancer.dns_name
}

output "localized_frontend_urls" {
  description = "Localized frontend entrypoints served by CloudFront."
  value = {
    es    = "https://${module.storage.cloudfront_domain_name}/es/login"
    en    = "https://${module.storage.cloudfront_domain_name}/en/login"
    pt_BR = "https://${module.storage.cloudfront_domain_name}/pt-BR/login"
  }
}

output "frontend_runtime_config" {
  description = "Public values written to runtime-config.json for every localized web build."
  value = {
    apiBaseUrl             = "${trimsuffix(var.api_public_url, "/")}/api"
    environment            = var.environment
    version                = var.app_version
    commitSha              = var.commit_sha
    buildTime              = var.build_time
    sessionIdleSeconds     = 300
    sessionWarningSeconds  = 240
    commercialEmailEnabled = false
  }
}

output "cloudfront_distribution_id" {
  description = "Localized frontend CloudFront distribution identifier."
  value       = module.storage.cloudfront_distribution_id
}

output "cloudfront_domain_name" {
  description = "Localized frontend CloudFront domain."
  value       = module.storage.cloudfront_domain_name
}

output "application_bucket_name" {
  description = "Private application storage bucket."
  value       = module.storage.application_bucket_name
}

output "web_bucket_name" {
  description = "Private localized frontend bucket."
  value       = module.storage.web_bucket_name
}

output "rds_endpoint" {
  description = "Private PostgreSQL endpoint used to compose DATABASE_URL out of band."
  value       = module.rds.endpoint
}

output "rds_master_user_secret_arn" {
  description = "RDS-managed master credential secret ARN."
  value       = module.rds.master_user_secret_arn
  sensitive   = true
}

output "redis_endpoint" {
  description = "Private TLS Redis endpoint used to compose REDIS_URL out of band."
  value       = "${module.redis.primary_endpoint_address}:${module.redis.port}"
}

output "application_secret_names" {
  description = "Empty secret containers that must be populated before enabling ECS service."
  value       = module.secrets.secret_names
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = module.ecs.cluster_name
}

output "ecs_task_definition_arn" {
  description = "API task definition ARN used for service and migration tasks."
  value       = module.ecs.task_definition_arn
}

output "cloudwatch_dashboard_name" {
  description = "CloudWatch operations dashboard."
  value       = module.observability.dashboard_name
}
