import { HealthService } from "./health.service";

describe("HealthService", () => {
  it("returns an ok health response", () => {
    const response = new HealthService({} as ConstructorParameters<typeof HealthService>[0]).getHealth();

    expect(response.status).toBe("ok");
    expect(response.service).toBe("kaklen-api");
    expect(response.version).toBe("0.1.0");
    expect(response.commitSha).toBe("local");
    expect(new Date(response.buildTime).toString()).not.toBe("Invalid Date");
    expect(new Date(response.timestamp).toString()).not.toBe("Invalid Date");
  });

  it("checks readiness through Prisma", async () => {
    const response = await new HealthService({
      $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }])
    } as unknown as ConstructorParameters<typeof HealthService>[0]).getReady();

    expect(response.status).toBe("ok");
  });
});
