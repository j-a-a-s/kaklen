output "dashboard_name" {
  description = "CloudWatch operations dashboard name."
  value       = aws_cloudwatch_dashboard.this.dashboard_name
}

output "alarm_names" {
  description = "Required staging alarm names."
  value = [
    aws_cloudwatch_metric_alarm.ecs_unhealthy.alarm_name,
    aws_cloudwatch_metric_alarm.alb_5xx.alarm_name,
    aws_cloudwatch_metric_alarm.ecs_cpu.alarm_name,
    aws_cloudwatch_metric_alarm.ecs_memory.alarm_name,
    aws_cloudwatch_metric_alarm.rds_storage.alarm_name,
    aws_cloudwatch_metric_alarm.rds_connections.alarm_name
  ]
}

output "sns_topic_arn" {
  description = "Optional SNS alert topic ARN."
  value       = var.enable_sns_alerts ? aws_sns_topic.alerts[0].arn : null
}
