variable "name_prefix" {
  description = "Prefix used for application secret paths."
  type        = string
}

variable "secrets" {
  description = "Map of secret environment variable names to descriptions. Values are populated out of band."
  type        = map(string)
}

variable "recovery_window_in_days" {
  description = "Recovery window used when an application secret is deleted."
  type        = number
  default     = 7

  validation {
    condition     = var.recovery_window_in_days >= 7 && var.recovery_window_in_days <= 30
    error_message = "Secret recovery window must be between 7 and 30 days."
  }
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
