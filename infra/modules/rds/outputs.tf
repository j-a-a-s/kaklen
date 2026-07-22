output "address" {
  description = "Private PostgreSQL hostname."
  value       = aws_db_instance.this.address
}

output "endpoint" {
  description = "Private PostgreSQL host and port."
  value       = aws_db_instance.this.endpoint
}

output "database_name" {
  description = "Initial PostgreSQL database name."
  value       = aws_db_instance.this.db_name
}

output "master_user_secret_arn" {
  description = "RDS-managed master credential secret ARN."
  value       = aws_db_instance.this.master_user_secret[0].secret_arn
  sensitive   = true
}

output "instance_id" {
  description = "RDS database instance identifier."
  value       = aws_db_instance.this.identifier
}
