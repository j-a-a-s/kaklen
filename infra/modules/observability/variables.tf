variable "name_prefix" {
  description = "Prefix used for alarms and dashboard resources."
  type        = string
}

variable "ecs_cluster_name" {
  description = "ECS cluster name used in metric dimensions."
  type        = string
}

variable "ecs_service_name" {
  description = "ECS service name used in metric dimensions."
  type        = string
}

variable "alb_arn_suffix" {
  description = "ALB ARN suffix used in metric dimensions."
  type        = string
}

variable "target_group_arn_suffix" {
  description = "ALB target group ARN suffix used in metric dimensions."
  type        = string
}

variable "rds_instance_id" {
  description = "RDS instance identifier used in metric dimensions."
  type        = string
}

variable "enable_sns_alerts" {
  description = "Creates an SNS topic and connects it to alarms."
  type        = bool
  default     = false
}

variable "cpu_threshold_percent" {
  description = "ECS CPU alarm threshold."
  type        = number
  default     = 80
}

variable "memory_threshold_percent" {
  description = "ECS memory alarm threshold."
  type        = number
  default     = 80
}

variable "rds_free_storage_threshold_bytes" {
  description = "RDS low free storage alarm threshold in bytes."
  type        = number
  default     = 2147483648
}

variable "rds_connections_threshold" {
  description = "RDS high connection count alarm threshold."
  type        = number
  default     = 80
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
