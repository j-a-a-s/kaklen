output "alb_security_group_id" {
  description = "ALB security group identifier."
  value       = aws_security_group.alb.id
}

output "ecs_security_group_id" {
  description = "ECS task security group identifier."
  value       = aws_security_group.ecs.id
}

output "rds_security_group_id" {
  description = "RDS security group identifier."
  value       = aws_security_group.rds.id
}

output "redis_security_group_id" {
  description = "ElastiCache security group identifier."
  value       = aws_security_group.redis.id
}

output "vpc_endpoint_ids" {
  description = "Private AWS service VPC endpoint identifiers."
  value = merge(
    { for name, endpoint in aws_vpc_endpoint.interface : name => endpoint.id },
    { s3 = aws_vpc_endpoint.s3.id }
  )
}
