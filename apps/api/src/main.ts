import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { readApiConfig } from "@kaklen/config";
import { KAKLEN_API_PREFIX } from "@kaklen/shared";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const config = readApiConfig(process.env);
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.enableCors({
    origin: ["http://localhost:4200"],
    credentials: true
  });
  app.setGlobalPrefix(KAKLEN_API_PREFIX);

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Kaklen API")
    .setDescription("Kaklen foundation API")
    .setVersion("0.1.0")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  await app.listen(config.port);
}

void bootstrap();
