import { HealthService } from "./health.service";

describe("HealthService", () => {
  it("returns an ok health response", () => {
    const commitSha = process.env.COMMIT_SHA;
    const nodeEnv = process.env.NODE_ENV;
    const publicEnvironment = process.env.PUBLIC_APP_ENVIRONMENT;
    delete process.env.COMMIT_SHA;
    process.env.NODE_ENV = "development";
    delete process.env.PUBLIC_APP_ENVIRONMENT;

    try {
      const response = new HealthService({} as ConstructorParameters<typeof HealthService>[0]).getHealth();

      expect(response.status).toBe("ok");
      expect(response.service).toBe("kaklen-api");
      expect(response.version).toBe("0.1.0");
      expect(response.commitSha).toBe("local");
      expect(response.environment).toBe("development");
      expect(response.checks.database).toBe("unknown");
      expect(new Date(response.buildTime).toString()).not.toBe("Invalid Date");
      expect(new Date(response.timestamp).toString()).not.toBe("Invalid Date");
    } finally {
      restoreEnvironmentVariable("COMMIT_SHA", commitSha);
      restoreEnvironmentVariable("NODE_ENV", nodeEnv);
      restoreEnvironmentVariable("PUBLIC_APP_ENVIRONMENT", publicEnvironment);
    }
  });

  it("checks readiness through Prisma", async () => {
    const response = await new HealthService({
      $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }])
    } as unknown as ConstructorParameters<typeof HealthService>[0]).getReady();

    expect(response.status).toBe("ok");
    expect(response.checks.database).toBe("ok");
  });

  it("returns not-ready metadata when the database dependency is unavailable", () => {
    const response = new HealthService({} as ConstructorParameters<typeof HealthService>[0]).getNotReady();

    expect(response.status).toBe("error");
    expect(response.checks.database).toBe("error");
  });
});

function restoreEnvironmentVariable(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
