import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { json, urlencoded } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { validateRuntimeEnvironment, type ApiConfig } from "@kaklen/config";
import { KAKLEN_API_PREFIX } from "@kaklen/shared";
import { AppModule } from "./app.module";
import { ApiErrorFilter } from "./common/api-error.filter";
import { requestLoggingMiddleware } from "./common/runtime-logging";

export async function bootstrap(): Promise<void> {
  const runtimeConfig = validateRuntimeEnvironment(process.env);
  const config = runtimeConfig.api;
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.enableShutdownHooks();
  configureHttpSecurity(app, config);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  app.useGlobalFilters(new ApiErrorFilter());
  app.setGlobalPrefix(KAKLEN_API_PREFIX);

  if (config.swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Kaklen API")
      .setDescription("Kaklen foundation API")
      .setVersion(config.appVersion)
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("docs", app, document);
  }

  await app.listen(config.port);
}

export function configureHttpSecurity(app: INestApplication, config: ApiConfig): void {
  const expressApp = app.getHttpAdapter().getInstance();
  if (config.trustProxy && typeof expressApp.set === "function") {
    expressApp.set("trust proxy", 1);
  }
  app.use(json({ limit: "1mb" }));
  app.use(urlencoded({ extended: true, limit: "1mb" }));
  app.use(
    helmet({
      frameguard: { action: "deny" },
      noSniff: true,
      referrerPolicy: { policy: "no-referrer" },
      hsts:
        config.nodeEnv === "production"
          ? { maxAge: 31_536_000, includeSubDomains: true, preload: false }
          : false
    })
  );
  app.use(cookieParser());
  app.use(requestLoggingMiddleware);
  app.enableCors({
    origin: config.corsAllowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    exposedHeaders: ["Content-Disposition", "Retry-After"],
    maxAge: 86400
  });
  if (typeof expressApp.disable === "function") {
    expressApp.disable("x-powered-by");
  }
}

if (require.main === module) {
  void bootstrap().catch((error: unknown) => {
    const message = messageForBootstrapError(error);
    console.error(message);
    if ((process.env.LOG_LEVEL ?? "").toLowerCase() === "debug") {
      console.error(error);
    }
    process.exit(1);
  });
}

export function messageForBootstrapError(error: unknown): string {
  const code = prismaErrorCode(error);
  if (code === "P1000") {
    return "No fue posible conectarse a PostgreSQL. Credenciales invalidas en DATABASE_URL.";
  }
  if (code === "P1001") {
    return "El servidor PostgreSQL no esta disponible. Verifique Docker y DATABASE_URL.";
  }
  if (code === "P1003") {
    return "La base de datos no existe. Ejecute pnpm setup para crearla cuando sea posible.";
  }
  return "No fue posible iniciar Kaklen API. Ejecute pnpm doctor para diagnosticar el entorno local.";
}

export function prismaErrorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  if (
    error &&
    typeof error === "object" &&
    "errorCode" in error &&
    typeof error.errorCode === "string"
  ) {
    return error.errorCode;
  }
  return undefined;
}
