variable "name_prefix" {
  description = "Prefix used for security group names."
  type        = string
}

variable "vpc_id" {
  description = "VPC identifier."
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR used to address the VPC DNS resolver."
  type        = string
}

variable "aws_region" {
  description = "AWS region used to construct VPC endpoint service names."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnets used by interface VPC endpoints."
  type        = list(string)
}

variable "private_route_table_ids" {
  description = "Private route tables used by the S3 gateway endpoint."
  type        = list(string)
}

variable "api_port" {
  description = "Container port exposed by the Kaklen API."
  type        = number
  default     = 3000
}

variable "smtp_port" {
  description = "SMTP destination port allowed from ECS."
  type        = number
  default     = 587
}

variable "approved_https_egress_cidrs" {
  description = "Explicit external HTTPS provider CIDRs. Empty keeps API traffic on VPC endpoints."
  type        = list(string)
  default     = []
}

variable "smtp_egress_cidrs" {
  description = "Explicit SMTP destination CIDRs. Empty disables SMTP egress."
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
