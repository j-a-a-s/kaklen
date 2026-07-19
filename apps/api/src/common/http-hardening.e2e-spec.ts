import { Controller, Get, Module, Post } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { ApiConfig } from "@kaklen/config";
import request from "supertest";
import { configureHttpSecurity } from "../main";

@Controller()
class SecurityProbeController {
  @Get("probe")
  probe(): { status: string } {
    return { status: "ok" };
  }

  @Post("api/auth/login")
  loginProbe(): { status: string } {
    return { status: "ok" };
  }
}

@Module({ controllers: [SecurityProbeController] })
class SecurityProbeModule {}

describe("HTTP production hardening", () => {
  it("sets explicit Helmet headers", async () => {
    const moduleRef = await Test.createTestingModule({ imports: [SecurityProbeModule] }).compile();
    const app = moduleRef.createNestApplication();
    configureHttpSecurity(app, apiConfig("production"));
    await app.init();

    const response = await request(app.getHttpServer()).get("/probe").expect(200);

    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["strict-transport-security"]).toBe(
      "max-age=31536000; includeSubDomains"
    );
    expect(response.headers["x-powered-by"]).toBeUndefined();
    await app.close();
  });

  it("serves the explicit credentialed CORS preflight contract", async () => {
    const moduleRef = await Test.createTestingModule({ imports: [SecurityProbeModule] }).compile();
    const app = moduleRef.createNestApplication();
    configureHttpSecurity(app, apiConfig("test"));
    await app.init();

    const response = await request(app.getHttpServer())
      .options("/api/auth/login")
      .set("Origin", "http://localhost:4200")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "Content-Type,Authorization,X-Request-Id")
      .expect(204);

    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:4200");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(response.headers["access-control-allow-methods"]).toBe(
      "GET,POST,PATCH,PUT,DELETE,OPTIONS"
    );
    expect(response.headers["access-control-allow-headers"]).toBe(
      "Content-Type,Authorization,X-Request-Id"
    );
    expect(response.headers["access-control-expose-headers"]).toBe(
      "Content-Disposition,Retry-After"
    );
    expect(response.headers["access-control-max-age"]).toBe("86400");
    await app.close();
  });
});

function apiConfig(nodeEnv: ApiConfig["nodeEnv"]): ApiConfig {
  return {
    nodeEnv,
    port: 3000,
    databaseUrl: "postgresql://local",
    databaseSsl: nodeEnv === "production",
    appVersion: "0.1.0",
    commitSha: "test",
    buildTime: "2026-07-19T00:00:00.000Z",
    corsAllowedOrigins: ["http://localhost:4200"],
    awsRegion: "us-east-1",
    awsS3Bucket: "test",
    logLevel: "error",
    trustProxy: false,
    swaggerEnabled: nodeEnv !== "production"
  };
}
