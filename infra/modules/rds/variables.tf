variable "name_prefix" {
  description = "Prefix used for RDS resource names."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnets used by the database subnet group."
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group restricted to ECS database traffic."
  type        = string
}

variable "database_name" {
  description = "Initial PostgreSQL database name."
  type        = string
  default     = "kaklen"
}

variable "master_username" {
  description = "PostgreSQL master username. The password is managed by RDS."
  type        = string
  default     = "kaklen_admin"
}

variable "instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.micro"
}

variable "allocated_storage_gib" {
  description = "Initial gp3 storage in GiB."
  type        = number
  default     = 20
}

variable "max_allocated_storage_gib" {
  description = "Maximum autoscaled gp3 storage in GiB."
  type        = number
  default     = 100
}

variable "backup_retention_days" {
  description = "Automated backup retention in days."
  type        = number
  default     = 7
}

variable "deletion_protection" {
  description = "Prevents accidental database deletion."
  type        = bool
  default     = true
}

variable "performance_insights_enabled" {
  description = "Enables RDS Performance Insights."
  type        = bool
  default     = true
}

variable "multi_az" {
  description = "Runs a synchronous standby in another availability zone."
  type        = bool
  default     = false
}

variable "skip_final_snapshot" {
  description = "Skips the final snapshot on deletion. Keep false outside disposable environments."
  type        = bool
  default     = false
}

variable "apply_immediately" {
  description = "Applies database changes outside the maintenance window."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
