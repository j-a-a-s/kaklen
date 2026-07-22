output "secret_arns" {
  description = "Application environment variable names mapped to Secrets Manager ARNs."
  value       = { for name, secret in aws_secretsmanager_secret.application : name => secret.arn }
}

output "secret_names" {
  description = "Application environment variable names mapped to Secrets Manager names."
  value       = { for name, secret in aws_secretsmanager_secret.application : name => secret.name }
}
