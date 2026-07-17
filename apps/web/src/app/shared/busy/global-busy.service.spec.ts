import { fakeAsync, tick } from "@angular/core/testing";
import { GlobalBusyService } from "./global-busy.service";

describe("GlobalBusyService", () => {
  let service: GlobalBusyService;

  beforeEach(() => {
    service = new GlobalBusyService();
    service.reset();
  });

  afterEach(() => service.reset());

  it("delays the cursor to avoid flicker", fakeAsync(() => {
    const operation = service.begin();
    tick(149);
    expect(service.visible()).toBeFalse();
    tick(1);
    expect(service.visible()).toBeTrue();
    expect(document.documentElement.classList.contains("kaklen-busy")).toBeTrue();
    operation.end();
    expect(service.visible()).toBeFalse();
  }));

  it("keeps progress visible until every concurrent operation ends", fakeAsync(() => {
    const first = service.begin();
    const second = service.begin();
    tick(150);
    first.end();
    first.end();
    expect(service.activeOperations()).toBe(1);
    expect(service.visible()).toBeTrue();
    second.end();
    expect(service.activeOperations()).toBe(0);
    expect(service.visible()).toBeFalse();
  }));

  it("restores state when a tracked promise fails", async () => {
    await expectAsync(
      service.run(async () => {
        throw new Error("failure");
      })
    ).toBeRejected();
    expect(service.activeOperations()).toBe(0);
  });
});
