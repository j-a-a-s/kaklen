import { fakeAsync, flushMicrotasks, tick } from "@angular/core/testing";
import { Router } from "@angular/router";
import { AuthService } from "../auth/auth.service";
import { NotificationService } from "../shared/notifications/notification.service";
import { OverlayCoordinatorService } from "../shared/overlay-coordinator.service";
import { SessionIdleConfiguration, SessionIdleService } from "./session-idle.service";

describe("SessionIdleService", () => {
  let service: SessionIdleService;
  let logout: jasmine.Spy;
  let clearLocalSession: jasmine.Spy;
  let navigateByUrl: jasmine.Spy;
  let warning: jasmine.Spy;
  let closeAll: jasmine.Spy;
  let broadcastDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    broadcastDescriptor = Object.getOwnPropertyDescriptor(globalThis, "BroadcastChannel");
    FakeBroadcastChannel.instances = [];
    Object.defineProperty(globalThis, "BroadcastChannel", {
      configurable: true,
      writable: true,
      value: FakeBroadcastChannel as unknown as typeof BroadcastChannel
    });
    logout = jasmine.createSpy("logout").and.resolveTo();
    clearLocalSession = jasmine.createSpy("clearLocalSession");
    navigateByUrl = jasmine.createSpy("navigateByUrl").and.resolveTo(true);
    warning = jasmine.createSpy("warning");
    closeAll = jasmine.createSpy("closeAll");
    service = new SessionIdleService(
      { warningSeconds: 4, idleSeconds: 5 } as SessionIdleConfiguration,
      { logout, clearLocalSession } as unknown as AuthService,
      { navigateByUrl } as unknown as Router,
      { warning } as unknown as NotificationService,
      { closeAll } as unknown as OverlayCoordinatorService
    );
  });

  afterEach(() => {
    service.stop();
    if (broadcastDescriptor) {
      Object.defineProperty(globalThis, "BroadcastChannel", broadcastDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "BroadcastChannel");
    }
  });

  it("warns at four minutes and logs out at five using controlled time", fakeAsync(() => {
    service.start();
    tick(4000);
    expect(service.warningVisible()).toBeTrue();
    expect(service.remainingSeconds()).toBe(1);
    tick(1000);
    flushMicrotasks();
    expect(logout).toHaveBeenCalledTimes(1);
    expect(closeAll).toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith("/login", { replaceUrl: true });
    expect(warning).toHaveBeenCalled();
  }));

  it("valid user activity resets the warning", fakeAsync(() => {
    service.start();
    tick(4000);
    expect(service.warningVisible()).toBeTrue();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(service.warningVisible()).toBeFalse();
    tick(3999);
    expect(service.warningVisible()).toBeFalse();
  }));

  it("removes activity listeners when stopped", () => {
    const remove = spyOn(document, "removeEventListener").and.callThrough();
    service.start();
    service.stop();
    expect(remove.calls.allArgs().some(([eventName]) => eventName === "keydown")).toBeTrue();
    expect(remove.calls.allArgs().some(([eventName]) => eventName === "click")).toBeTrue();
  });

  it("synchronizes activity and logout across browser tabs", fakeAsync(() => {
    service.start();
    tick(4000);
    expect(service.warningVisible()).toBeTrue();
    const channel = FakeBroadcastChannel.instances[0];

    channel.emit({ type: "activity", occurredAt: Date.now() + 1000 });
    expect(service.warningVisible()).toBeFalse();

    channel.emit({ type: "logout", occurredAt: Date.now() + 2000 });
    flushMicrotasks();
    expect(clearLocalSession).toHaveBeenCalledTimes(1);
    expect(closeAll).toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith("/login", { replaceUrl: true });
    expect(channel.closed).toBeTrue();
  }));
});

type FakeSessionMessage =
  | { type: "activity"; occurredAt: number }
  | { type: "logout"; occurredAt: number };

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];
  readonly name: string;
  readonly messages: FakeSessionMessage[] = [];
  closed = false;
  private listeners: Array<(event: MessageEvent<FakeSessionMessage>) => void> = [];

  constructor(name: string) {
    this.name = name;
    FakeBroadcastChannel.instances.push(this);
  }

  addEventListener(_type: string, listener: (event: MessageEvent<FakeSessionMessage>) => void): void {
    this.listeners.push(listener);
  }

  removeEventListener(_type: string, listener: (event: MessageEvent<FakeSessionMessage>) => void): void {
    this.listeners = this.listeners.filter((candidate) => candidate !== listener);
  }

  postMessage(message: FakeSessionMessage): void {
    this.messages.push(message);
  }

  emit(message: FakeSessionMessage): void {
    const event = new MessageEvent<FakeSessionMessage>("message", { data: message });
    this.listeners.forEach((listener) => listener(event));
  }

  close(): void {
    this.closed = true;
    this.listeners = [];
  }
}
