variable "name_prefix" {
  description = "Prefix used for load balancer resources."
  type        = string
}

variable "vpc_id" {
  description = "VPC identifier."
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnets used by the ALB."
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group attached to the ALB."
  type        = string
}

variable "target_port" {
  description = "Kaklen API target port."
  type        = number
  default     = 3000
}

variable "health_check_path" {
  description = "API liveness endpoint used by the target group."
  type        = string
  default     = "/api/health/live"
}

variable "certificate_arn" {
  description = "ACM certificate ARN used by the HTTPS listener."
  type        = string
}

variable "enable_deletion_protection" {
  description = "Protects the ALB from accidental deletion."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
