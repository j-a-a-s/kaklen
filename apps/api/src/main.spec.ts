describe("API bootstrap", () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock("@nestjs/core");
    jest.dontMock("@nestjs/swagger");
    jest.dontMock("express");
    jest.dontMock("cookie-parser");
    jest.dontMock("helmet");
    jest.dontMock("@kaklen/config");
    jest.dontMock("./app.module");
  });

  it("configures the Nest app for production-like runtime", async () => {
    const { app, expressApp, helmetMiddleware, swaggerSetup } = mockBootstrapDependencies({
      trustProxy: true,
      expressHasSet: true,
      expressHasDisable: true,
      nodeEnv: "test",
      swaggerEnabled: true
    });
    const { bootstrap } = await import("./main");

    await bootstrap();

    expect(app.enableShutdownHooks).toHaveBeenCalled();
    expect(expressApp.set).toHaveBeenCalledWith("trust proxy", 1);
    expect(app.use).toHaveBeenCalledTimes(5);
    expect(app.enableCors).toHaveBeenCalledWith({
      origin: ["http://localhost:4200"],
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
      exposedHeaders: ["Content-Disposition", "Retry-After"],
      maxAge: 86400
    });
    expect(helmetMiddleware).toHaveBeenCalledWith({
      frameguard: { action: "deny" },
      noSniff: true,
      referrerPolicy: { policy: "no-referrer" },
      hsts: false
    });
    expect(expressApp.disable).toHaveBeenCalledWith("x-powered-by");
    expect(app.useGlobalPipes).toHaveBeenCalledTimes(1);
    expect(app.useGlobalFilters).toHaveBeenCalledTimes(1);
    expect(app.setGlobalPrefix).toHaveBeenCalledWith("api");
    expect(swaggerSetup).toHaveBeenCalledWith("docs", app, { openapi: "doc" });
    expect(app.listen).toHaveBeenCalledWith(3000);
  });

  it("skips optional express hooks when unavailable", async () => {
    const { expressApp } = mockBootstrapDependencies({
      trustProxy: false,
      expressHasSet: false,
      expressHasDisable: false,
      nodeEnv: "test",
      swaggerEnabled: true
    });
    const { bootstrap } = await import("./main");

    await bootstrap();

    expect(expressApp.set).toBeUndefined();
    expect(expressApp.disable).toBeUndefined();
  });

  it("enables HSTS and keeps Swagger disabled in production", async () => {
    const { helmetMiddleware, swaggerSetup } = mockBootstrapDependencies({
      trustProxy: true,
      expressHasSet: true,
      expressHasDisable: true,
      nodeEnv: "production",
      swaggerEnabled: false
    });
    const { bootstrap } = await import("./main");

    await bootstrap();

    expect(helmetMiddleware).toHaveBeenCalledWith(
      expect.objectContaining({
        hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: false }
      })
    );
    expect(swaggerSetup).not.toHaveBeenCalled();
  });

  it("fails product startup before creating Nest when configuration is unsafe", async () => {
    const { nestCreate } = mockBootstrapDependencies({
      trustProxy: true,
      expressHasSet: true,
      expressHasDisable: true,
      nodeEnv: "production",
      swaggerEnabled: false,
      validationError: new Error("JWT_ACCESS_SECRET contains a forbidden placeholder")
    });
    const { bootstrap } = await import("./main");

    await expect(bootstrap()).rejects.toThrow("forbidden placeholder");
    expect(nestCreate).not.toHaveBeenCalled();
  });

  it("maps Prisma startup errors to actionable local diagnostics", async () => {
    const { messageForBootstrapError, prismaErrorCode } = await import("./main");

    expect(messageForBootstrapError({ code: "P1000" })).toContain("Credenciales invalidas");
    expect(messageForBootstrapError({ errorCode: "P1001" })).toContain("PostgreSQL no esta disponible");
    expect(messageForBootstrapError({ code: "P1003" })).toContain("base de datos no existe");
    expect(messageForBootstrapError(new Error("boom"))).toContain("pnpm doctor");
    expect(prismaErrorCode({ code: "P1000" })).toBe("P1000");
    expect(prismaErrorCode({ errorCode: "P1001" })).toBe("P1001");
    expect(prismaErrorCode(null)).toBeUndefined();
  });
});

function mockBootstrapDependencies(options: {
  trustProxy: boolean;
  expressHasSet: boolean;
  expressHasDisable: boolean;
  nodeEnv: "test" | "production";
  swaggerEnabled: boolean;
  validationError?: Error;
}) {
  const expressApp: { set?: jest.Mock; disable?: jest.Mock } = {};
  if (options.expressHasSet) {
    expressApp.set = jest.fn();
  }
  if (options.expressHasDisable) {
    expressApp.disable = jest.fn();
  }
  const app = {
    enableShutdownHooks: jest.fn(),
    getHttpAdapter: jest.fn(() => ({ getInstance: () => expressApp })),
    use: jest.fn(),
    enableCors: jest.fn(),
    useGlobalPipes: jest.fn(),
    useGlobalFilters: jest.fn(),
    setGlobalPrefix: jest.fn(),
    listen: jest.fn(async () => undefined)
  };
  const swaggerSetup = jest.fn();
  const helmetMiddleware = jest.fn(() => "helmet-middleware");

  const nestCreate = jest.fn(async () => app);
  jest.doMock("@nestjs/core", () => ({ NestFactory: { create: nestCreate } }));
  jest.doMock("@nestjs/swagger", () => ({
    DocumentBuilder: jest.fn().mockImplementation(() => ({
      setTitle: jest.fn().mockReturnThis(),
      setDescription: jest.fn().mockReturnThis(),
      setVersion: jest.fn().mockReturnThis(),
      addBearerAuth: jest.fn().mockReturnThis(),
      build: jest.fn(() => ({ title: "Kaklen API" }))
    })),
    SwaggerModule: {
      createDocument: jest.fn(() => ({ openapi: "doc" })),
      setup: swaggerSetup
    }
  }));
  jest.doMock("express", () => ({
    json: jest.fn(() => "json-middleware"),
    urlencoded: jest.fn(() => "urlencoded-middleware")
  }));
  jest.doMock("cookie-parser", () => jest.fn(() => "cookie-middleware"));
  jest.doMock("helmet", () => helmetMiddleware);
  jest.doMock("@kaklen/config", () => ({
    validateRuntimeEnvironment: jest.fn(() => {
      if (options.validationError) {
        throw options.validationError;
      }
      return {
        api: {
          nodeEnv: options.nodeEnv,
          port: 3000,
          appVersion: "0.1.0",
          corsAllowedOrigins: ["http://localhost:4200"],
          trustProxy: options.trustProxy,
          swaggerEnabled: options.swaggerEnabled
        }
      };
    })
  }));
  jest.doMock("./app.module", () => ({ AppModule: class AppModule {} }));

  return { app, expressApp, helmetMiddleware, nestCreate, swaggerSetup };
}
