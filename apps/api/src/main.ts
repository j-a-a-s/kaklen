import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ValidationPipe } from "@nestjs/common";
import { json, urlencoded } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { readApiConfig } from "@kaklen/config";
import { KAKLEN_API_PREFIX } from "@kaklen/shared";
import { AppModule } from "./app.module";
import { ApiErrorFilter } from "./common/api-error.filter";
import { requestLoggingMiddleware } from "./common/runtime-logging";

async function bootstrap(): Promise<void> {
  const config = readApiConfig(process.env);
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.enableShutdownHooks();
  const expressApp = app.getHttpAdapter().getInstance();
  if (config.trustProxy && typeof expressApp.set === "function") {
    expressApp.set("trust proxy", 1);
  }
  app.use(json({ limit: "1mb" }));
  app.use(urlencoded({ extended: true, limit: "1mb" }));
  app.use(helmet());
  app.use(cookieParser());
  app.use(requestLoggingMiddleware);
  app.enableCors({
    origin: config.corsAllowedOrigins,
    credentials: true
  });
  if (typeof expressApp.disable === "function") {
    expressApp.disable("x-powered-by");
  }
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  app.useGlobalFilters(new ApiErrorFilter());
  app.setGlobalPrefix(KAKLEN_API_PREFIX);

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Kaklen API")
    .setDescription("Kaklen foundation API")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  await app.listen(config.port);
}

void bootstrap();
