output "arn" {
  description = "ALB ARN."
  value       = aws_lb.this.arn
}

output "arn_suffix" {
  description = "ALB ARN suffix used by CloudWatch metrics."
  value       = aws_lb.this.arn_suffix
}

output "dns_name" {
  description = "ALB DNS name."
  value       = aws_lb.this.dns_name
}

output "target_group_arn" {
  description = "API target group ARN."
  value       = aws_lb_target_group.api.arn
}

output "target_group_arn_suffix" {
  description = "Target group ARN suffix used by CloudWatch metrics."
  value       = aws_lb_target_group.api.arn_suffix
}

output "web_acl_arn" {
  description = "Regional WAF web ACL protecting the API ALB."
  value       = aws_wafv2_web_acl.this.arn
}
