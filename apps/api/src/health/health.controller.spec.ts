import { HttpStatus } from "@nestjs/common";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  it("returns health and liveness responses", () => {
    const service = makeHealthService();
    const controller = new HealthController(service as never);

    expect(controller.getHealth()).toEqual({ status: "ok" });
    expect(controller.getLive()).toEqual({ status: "ok", live: true });
  });

  it("returns ready when dependencies are healthy", async () => {
    const service = makeHealthService();
    const controller = new HealthController(service as never);
    const response = { status: jest.fn() };

    await expect(controller.getReady(response as never)).resolves.toEqual({ status: "ok", ready: true });
    expect(response.status).not.toHaveBeenCalled();
  });

  it("sets 503 and returns not-ready payload when readiness fails", async () => {
    const service = makeHealthService({ readyFails: true });
    const controller = new HealthController(service as never);
    const response = { status: jest.fn() };

    await expect(controller.getReady(response as never)).resolves.toEqual({ status: "error", ready: false });
    expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
  });
});

function makeHealthService(options: { readyFails?: boolean } = {}) {
  return {
    getHealth: jest.fn(() => ({ status: "ok" })),
    getLive: jest.fn(() => ({ status: "ok", live: true })),
    getReady: jest.fn(async () => {
      if (options.readyFails) {
        throw new Error("database unavailable");
      }
      return { status: "ok", ready: true };
    }),
    getNotReady: jest.fn(() => ({ status: "error", ready: false }))
  };
}
