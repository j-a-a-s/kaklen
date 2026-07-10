import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { readApiConfig } from "@kaklen/config";
import { KAKLEN_API_PREFIX } from "@kaklen/shared";
import { AppModule } from "./app.module";
import { ApiErrorFilter } from "./common/api-error.filter";

async function bootstrap(): Promise<void> {
  const config = readApiConfig(process.env);
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: ["http://localhost:4200"],
    credentials: true
  });
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
