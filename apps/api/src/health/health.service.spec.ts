import { HealthService } from "./health.service";

describe("HealthService", () => {
  it("returns an ok health response", () => {
    const response = new HealthService().getHealth();

    expect(response.status).toBe("ok");
    expect(response.service).toBe("kaklen-api");
    expect(new Date(response.timestamp).toString()).not.toBe("Invalid Date");
  });
});
