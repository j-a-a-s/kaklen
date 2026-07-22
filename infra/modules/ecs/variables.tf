variable "name_prefix" {
  description = "Prefix used for ECS and IAM resource names."
  type        = string
}

variable "aws_region" {
  description = "AWS region used by the awslogs driver."
  type        = string
}

variable "api_image" {
  description = "Immutable Kaklen API image reference, preferably pinned by digest."
  type        = string
}

variable "api_ecr_repository_arn" {
  description = "ECR repository ARN containing the API image."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnets used by Fargate tasks."
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group attached to Fargate tasks."
  type        = string
}

variable "target_group_arn" {
  description = "ALB target group receiving API traffic."
  type        = string
}

variable "application_bucket_arn" {
  description = "Private application storage bucket ARN."
  type        = string
}

variable "application_kms_key_arn" {
  description = "Customer-managed KMS key ARN protecting application objects."
  type        = string
}

variable "environment" {
  description = "Non-secret environment variables injected into the API container."
  type        = map(string)
  default     = {}
}

variable "secrets" {
  description = "Secret environment variable names mapped to Secrets Manager ARNs."
  type        = map(string)
  default     = {}
}

variable "container_port" {
  description = "API container port."
  type        = number
  default     = 3000
}

variable "cpu" {
  description = "Fargate task CPU units."
  type        = number
  default     = 512
}

variable "memory" {
  description = "Fargate task memory in MiB."
  type        = number
  default     = 1024
}

variable "desired_count" {
  description = "Desired ECS service task count."
  type        = number
  default     = 1
}

variable "enable_service" {
  description = "Creates the ECS service after external secret values have been populated."
  type        = bool
  default     = false
}

variable "enable_autoscaling" {
  description = "Enables target tracking autoscaling for the ECS service."
  type        = bool
  default     = true
}

variable "autoscaling_min_capacity" {
  description = "Minimum number of ECS tasks."
  type        = number
  default     = 1
}

variable "autoscaling_max_capacity" {
  description = "Maximum number of ECS tasks."
  type        = number
  default     = 4
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days."
  type        = number
  default     = 30
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
