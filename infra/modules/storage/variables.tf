variable "name_prefix" {
  description = "Prefix used for storage and CDN resources."
  type        = string
}

variable "application_bucket_name" {
  description = "Globally unique private bucket name for application objects."
  type        = string
}

variable "web_bucket_name" {
  description = "Globally unique private bucket name for localized web builds."
  type        = string
}

variable "versioning_enabled" {
  description = "Enables object versioning in both buckets."
  type        = bool
  default     = true
}

variable "lifecycle_enabled" {
  description = "Enables incomplete upload and noncurrent version cleanup."
  type        = bool
  default     = true
}

variable "noncurrent_version_expiration_days" {
  description = "Days before noncurrent object versions expire."
  type        = number
  default     = 30
}

variable "application_cors_allowed_origins" {
  description = "Explicit origins allowed to use signed application object requests."
  type        = list(string)
  default     = []
}

variable "cloudfront_aliases" {
  description = "Optional DNS aliases for the localized frontend distribution."
  type        = list(string)
  default     = []
}

variable "cloudfront_certificate_arn" {
  description = "ACM certificate ARN in us-east-1 when CloudFront aliases are configured."
  type        = string
  default     = null
}

variable "price_class" {
  description = "CloudFront edge location price class."
  type        = string
  default     = "PriceClass_100"
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
