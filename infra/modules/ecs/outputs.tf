output "cluster_name" {
  description = "ECS cluster name."
  value       = aws_ecs_cluster.this.name
}

output "service_name" {
  description = "ECS service name, including the planned name before service enablement."
  value       = local.service_name
}

output "service_arn" {
  description = "ECS service ARN, null until service enablement."
  value       = var.enable_service ? aws_ecs_service.api[0].id : null
}

output "task_definition_arn" {
  description = "Kaklen API task definition ARN."
  value       = aws_ecs_task_definition.api.arn
}

output "execution_role_arn" {
  description = "ECS execution role ARN."
  value       = aws_iam_role.execution.arn
}

output "task_role_arn" {
  description = "Kaklen API task role ARN."
  value       = aws_iam_role.task.arn
}

output "log_group_name" {
  description = "API CloudWatch log group name."
  value       = aws_cloudwatch_log_group.api.name
}

output "log_group_arn" {
  description = "API CloudWatch log group ARN."
  value       = aws_cloudwatch_log_group.api.arn
}
