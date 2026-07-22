output "application_bucket_name" {
  description = "Private application object bucket name."
  value       = aws_s3_bucket.this["application"].id
}

output "application_bucket_arn" {
  description = "Private application object bucket ARN."
  value       = aws_s3_bucket.this["application"].arn
}

output "application_kms_key_arn" {
  description = "Customer-managed KMS key protecting application objects."
  value       = aws_kms_key.application.arn
}

output "web_bucket_name" {
  description = "Private localized web bucket name."
  value       = aws_s3_bucket.this["web"].id
}

output "cloudfront_distribution_id" {
  description = "Localized frontend CloudFront distribution identifier."
  value       = aws_cloudfront_distribution.web.id
}

output "cloudfront_distribution_arn" {
  description = "Localized frontend CloudFront distribution ARN."
  value       = aws_cloudfront_distribution.web.arn
}

output "cloudfront_domain_name" {
  description = "Localized frontend CloudFront hostname."
  value       = aws_cloudfront_distribution.web.domain_name
}
