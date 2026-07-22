variable "name_prefix" {
  description = "Prefix used for ElastiCache resource names."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnets used by ElastiCache."
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group restricted to ECS Redis traffic."
  type        = string
}

variable "node_type" {
  description = "ElastiCache node type."
  type        = string
  default     = "cache.t4g.micro"
}

variable "num_cache_clusters" {
  description = "Number of cache nodes in the replication group."
  type        = number
  default     = 1

  validation {
    condition     = var.num_cache_clusters >= 1
    error_message = "At least one cache node is required."
  }
}

variable "auth_token" {
  description = "Optional Redis AUTH token supplied through an ephemeral sensitive input."
  type        = string
  default     = null
  sensitive   = true

  validation {
    condition     = var.auth_token == null || length(var.auth_token) >= 32
    error_message = "Redis auth token must contain at least 32 characters when set."
  }
}

variable "snapshot_retention_limit" {
  description = "Daily snapshot retention in days."
  type        = number
  default     = 3
}

variable "apply_immediately" {
  description = "Applies cache changes outside the maintenance window."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
