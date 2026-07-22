resource "aws_secretsmanager_secret" "application" {
  for_each = var.secrets

  name                    = "/${var.name_prefix}/${lower(replace(each.key, "_", "-"))}"
  description             = each.value
  recovery_window_in_days = var.recovery_window_in_days

  tags = merge(var.tags, {
    Name        = "${var.name_prefix}-${lower(replace(each.key, "_", "-"))}"
    Environment = "staging"
  })
}
