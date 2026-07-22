variable "project_name" {
  description = "Project identifier used in AWS resource names."
  type        = string
  default     = "kaklen"
}

variable "environment" {
  description = "Deployment environment. This root module is restricted to staging."
  type        = string
  default     = "staging"

  validation {
    condition     = var.environment == "staging"
    error_message = "The staging root module only accepts environment=staging."
  }
}

variable "aws_region" {
  description = "AWS region hosting the staging workload."
  type        = string
  default     = "us-east-1"
}

variable "offline_validation" {
  description = "Skips AWS account calls for credential-free validation and planning. Set false before deployment."
  type        = bool
  default     = true
}

variable "availability_zones" {
  description = "At least two availability zones in the selected region."
  type        = list(string)

  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least two availability zones are required."
  }
}

variable "vpc_cidr" {
  description = "IPv4 CIDR assigned to the staging VPC."
  type        = string
  default     = "10.40.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDRs ordered by availability zone."
  type        = list(string)
}

variable "private_subnet_cidrs" {
  description = "Private subnet CIDRs ordered by availability zone."
  type        = list(string)
}

variable "enable_nat_gateway" {
  description = "Enables outbound connectivity for private ECS tasks."
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Uses one NAT gateway to control staging cost."
  type        = bool
  default     = true
}

variable "api_image" {
  description = "Immutable API image reference. Use an ECR digest for deployable plans."
  type        = string

  validation {
    condition     = length(trimspace(var.api_image)) > 0
    error_message = "api_image cannot be empty."
  }

  validation {
    condition     = !var.enable_ecs_service || can(regex("@sha256:[a-f0-9]{64}$", var.api_image))
    error_message = "The enabled ECS service requires api_image pinned by SHA-256 digest."
  }
}

variable "api_ecr_repository_arn" {
  description = "ECR repository ARN used to scope image-pull permissions."
  type        = string

  validation {
    condition     = can(regex("^arn:[^:]+:ecr:[^:]+:[0-9]{12}:repository/", var.api_ecr_repository_arn))
    error_message = "api_ecr_repository_arn must be an ECR repository ARN."
  }
}

variable "api_port" {
  description = "Kaklen API container port."
  type        = number
  default     = 3000
}

variable "api_cpu" {
  description = "Fargate API CPU units."
  type        = number
  default     = 512
}

variable "api_memory" {
  description = "Fargate API memory in MiB."
  type        = number
  default     = 1024
}

variable "api_desired_count" {
  description = "Desired API task count after service enablement."
  type        = number
  default     = 1
}

variable "enable_ecs_service" {
  description = "Creates the API service after secrets and TLS are configured."
  type        = bool
  default     = false
}

variable "enable_ecs_autoscaling" {
  description = "Enables ECS target tracking policies."
  type        = bool
  default     = true
}

variable "ecs_min_capacity" {
  description = "Minimum API task count."
  type        = number
  default     = 1
}

variable "ecs_max_capacity" {
  description = "Maximum API task count."
  type        = number
  default     = 4
}

variable "alb_certificate_arn" {
  description = "ACM certificate ARN required by the HTTPS API ALB."
  type        = string

  validation {
    condition     = can(regex("^arn:[^:]+:acm:[^:]+:[0-9]{12}:certificate/", var.alb_certificate_arn))
    error_message = "alb_certificate_arn must be an ACM certificate ARN."
  }
}

variable "alb_deletion_protection" {
  description = "Prevents accidental ALB deletion."
  type        = bool
  default     = false
}

variable "application_bucket_name" {
  description = "Globally unique private application storage bucket name."
  type        = string
}

variable "web_bucket_name" {
  description = "Globally unique private localized frontend bucket name."
  type        = string
}

variable "storage_versioning_enabled" {
  description = "Enables versioning for application and web buckets."
  type        = bool
  default     = true
}

variable "storage_lifecycle_enabled" {
  description = "Enables noncurrent version and incomplete upload cleanup."
  type        = bool
  default     = true
}

variable "cloudfront_aliases" {
  description = "Optional staging frontend DNS aliases."
  type        = list(string)
  default     = []
}

variable "cloudfront_certificate_arn" {
  description = "ACM certificate ARN in us-east-1 for CloudFront aliases."
  type        = string
  default     = null
}

variable "cloudfront_price_class" {
  description = "CloudFront price class used by staging."
  type        = string
  default     = "PriceClass_100"
}

variable "app_public_url" {
  description = "Public localized frontend origin."
  type        = string

  validation {
    condition     = can(regex("^https://[^/]+$", var.app_public_url))
    error_message = "app_public_url must be an HTTPS origin without a path."
  }
}

variable "app_web_url" {
  description = "Primary web origin used by invitations."
  type        = string

  validation {
    condition     = can(regex("^https://[^/]+$", var.app_web_url))
    error_message = "app_web_url must be an HTTPS origin without a path."
  }
}

variable "api_public_url" {
  description = "Public API origin without the /api suffix."
  type        = string

  validation {
    condition     = can(regex("^https://[^/]+$", var.api_public_url))
    error_message = "api_public_url must be an HTTPS origin without a path."
  }
}

variable "app_version" {
  description = "Application version exposed by health and runtime config."
  type        = string
}

variable "commit_sha" {
  description = "Source commit exposed by health and runtime config."
  type        = string
}

variable "build_time" {
  description = "Optional ISO-8601 image build timestamp."
  type        = string
  default     = ""
}

variable "database_name" {
  description = "Initial RDS PostgreSQL database name."
  type        = string
  default     = "kaklen"
}

variable "database_master_username" {
  description = "RDS master username. RDS manages its password."
  type        = string
  default     = "kaklen_admin"
}

variable "database_instance_class" {
  description = "RDS staging instance class."
  type        = string
  default     = "db.t4g.micro"
}

variable "database_allocated_storage_gib" {
  description = "Initial RDS storage in GiB."
  type        = number
  default     = 20
}

variable "database_max_allocated_storage_gib" {
  description = "Maximum RDS autoscaled storage in GiB."
  type        = number
  default     = 100
}

variable "database_backup_retention_days" {
  description = "RDS automated backup retention."
  type        = number
  default     = 7
}

variable "database_deletion_protection" {
  description = "Prevents accidental RDS deletion."
  type        = bool
  default     = true
}

variable "database_performance_insights_enabled" {
  description = "Enables RDS Performance Insights."
  type        = bool
  default     = true
}

variable "database_multi_az" {
  description = "Enables an RDS standby in a second availability zone."
  type        = bool
  default     = false
}

variable "redis_node_type" {
  description = "ElastiCache staging node type."
  type        = string
  default     = "cache.t4g.micro"
}

variable "redis_num_cache_clusters" {
  description = "ElastiCache node count. Use at least two for automatic failover."
  type        = number
  default     = 1
}

variable "redis_auth_token" {
  description = "Optional Redis AUTH token. Supply only through an ephemeral sensitive input."
  type        = string
  default     = null
  sensitive   = true
}

variable "mail_host" {
  description = "Staging SMTP hostname."
  type        = string
  default     = "smtp.example.invalid"
}

variable "mail_port" {
  description = "Staging SMTP port."
  type        = number
  default     = 587
}

variable "mail_from" {
  description = "Staging transactional email sender."
  type        = string
  default     = "Kaklen <no-reply@example.invalid>"
}

variable "smtp_egress_cidrs" {
  description = "Explicit SMTP provider network CIDRs. Empty disables SMTP egress."
  type        = list(string)
  default     = []
}

variable "approved_https_egress_cidrs" {
  description = "Explicit external provider CIDRs allowed from ECS over HTTPS."
  type        = list(string)
  default     = []
}

variable "enable_sns_alerts" {
  description = "Creates an encrypted SNS topic and connects required alarms."
  type        = bool
  default     = false
}

variable "log_retention_days" {
  description = "CloudWatch API log retention."
  type        = number
  default     = 30
}

variable "extra_tags" {
  description = "Additional non-sensitive AWS tags."
  type        = map(string)
  default     = {}
}
