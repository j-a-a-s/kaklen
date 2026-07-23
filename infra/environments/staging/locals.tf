locals {
  name_prefix = "${var.project_name}-${var.environment}"

  common_tags = merge(var.extra_tags, {
    Application = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
    Repository  = "j-a-a-s/kaklen"
  })

  application_secret_descriptions = {
    DATABASE_URL           = "Prisma PostgreSQL URL with sslmode=require"
    JWT_ACCESS_SECRET      = "JWT access token signing secret"
    JWT_REFRESH_SECRET     = "JWT refresh token signing secret"
    PAYMENT_SANDBOX_SECRET = "Sandbox payment callback secret"
    RATE_LIMIT_HASH_SECRET = "Distributed rate-limit HMAC secret"
    REDIS_URL              = "TLS Redis URL for queues and distributed limits"
    WHATSAPP_HASH_SECRET   = "WhatsApp operational identifier HMAC secret"
  }

  api_environment = {
    API_PORT                                = tostring(var.api_port)
    APP_PUBLIC_URL                          = var.app_public_url
    APP_VERSION                             = var.app_version
    APP_WEB_URL                             = var.app_web_url
    AUTH_ALLOWED_ORIGINS                    = var.app_public_url
    AUTH_EMAIL_ENABLED                      = "true"
    AWS_REGION                              = var.aws_region
    AWS_S3_BUCKET                           = module.storage.application_bucket_name
    BUILD_TIME                              = var.build_time
    COMMERCIAL_EMAIL_ENABLED                = "false"
    COMMIT_SHA                              = var.commit_sha
    COOKIE_SECURE                           = "true"
    CORS_ALLOWED_ORIGINS                    = join(",", [var.app_public_url, var.marketing_public_url])
    DATABASE_SSL                            = "true"
    EMAIL_VERIFICATION_EXPIRES_MINUTES      = "1440"
    JWT_ACCESS_EXPIRES_SECONDS              = "900"
    JWT_REFRESH_EXPIRES_SECONDS             = "604800"
    LEAD_NOTIFICATION_EMAIL                 = var.lead_notification_email
    LOG_LEVEL                               = "info"
    MAIL_CONNECTION_TIMEOUT_MS              = "5000"
    MAIL_FROM                               = var.mail_from
    MAIL_GREETING_TIMEOUT_MS                = "5000"
    MAIL_HOST                               = var.mail_host
    MAIL_PORT                               = tostring(var.mail_port)
    MAIL_SECURE                             = "false"
    MAIL_SOCKET_TIMEOUT_MS                  = "10000"
    MARKETING_SITE_URL                      = var.marketing_public_url
    NODE_ENV                                = "production"
    ORGANIZATION_INVITATION_EXPIRES_SECONDS = "259200"
    PASSWORD_RESET_EXPIRES_MINUTES          = "30"
    PAYMENT_GATEWAY                         = "sandbox"
    PORT                                    = tostring(var.api_port)
    PUBLIC_APP_ENVIRONMENT                  = var.environment
    SWAGGER_ENABLED                         = "false"
    TRUST_PROXY                             = "true"
    WHATSAPP_MODE                           = "manual"
  }
}

check "network_lists_match" {
  assert {
    condition = (
      length(var.availability_zones) == length(var.public_subnet_cidrs) &&
      length(var.availability_zones) == length(var.private_subnet_cidrs)
    )
    error_message = "Availability zones, public subnets and private subnets must have equal lengths."
  }
}

check "cloudfront_tls_configuration" {
  assert {
    condition     = length(var.cloudfront_aliases) == 0 || var.cloudfront_certificate_arn != null
    error_message = "CloudFront aliases require an ACM certificate in us-east-1."
  }
}

check "ecs_service_tls_configuration" {
  assert {
    condition     = length(trimspace(var.alb_certificate_arn)) > 0
    error_message = "The ECS service requires an HTTPS ALB certificate."
  }
}
