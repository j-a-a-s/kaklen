variable "name_prefix" {
  description = "Prefix used for network resource names."
  type        = string
}

variable "vpc_cidr" {
  description = "IPv4 CIDR assigned to the VPC."
  type        = string
}

variable "availability_zones" {
  description = "Availability zones used by public and private subnets."
  type        = list(string)

  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least two availability zones are required."
  }
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDRs in availability zone order."
  type        = list(string)
}

variable "private_subnet_cidrs" {
  description = "Private subnet CIDRs in availability zone order."
  type        = list(string)
}

variable "enable_nat_gateway" {
  description = "Creates NAT connectivity for private subnets."
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Uses one NAT gateway for staging cost control when enabled."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}
