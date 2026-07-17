import { Injectable, OnDestroy, signal } from "@angular/core";
import { Router } from "@angular/router";
import { AuthService } from "../auth/auth.service";
import { NotificationService } from "../shared/notifications/notification.service";
import { OverlayCoordinatorService } from "../shared/overlay-coordinator.service";
import { RUNTIME_CONFIG } from "../config/runtime-config";

export interface SessionIdleConfig {
  idleSeconds: number;
  warningSeconds: number;
}

@Injectable({ providedIn: "root" })
export class SessionIdleConfiguration implements SessionIdleConfig {
  readonly idleSeconds = RUNTIME_CONFIG.sessionIdleSeconds;
  readonly warningSeconds = RUNTIME_CONFIG.sessionWarningSeconds;
}

type SessionChannelMessage =
  | { type: "activity"; occurredAt: number }
  | { type: "logout"; occurredAt: number };

const ACTIVITY_EVENTS: readonly (keyof DocumentEventMap)[] = [
  "click",
  "keydown",
  "touchstart",
  "scroll",
  "dragstart"
];

@Injectable({ providedIn: "root" })
export class SessionIdleService implements OnDestroy {
  readonly warningVisible = signal(false);
  readonly remainingSeconds = signal(0);
  private lastActivityAt = 0;
  private ticker: number | null = null;
  private channel: BroadcastChannel | null = null;
  private running = false;
  private expiring = false;
  private readonly onActivity = (): void => this.registerActivity(true);

  constructor(
    private readonly config: SessionIdleConfiguration,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly notifications: NotificationService,
    private readonly overlays: OverlayCoordinatorService
  ) {
    if (
      !Number.isInteger(config.idleSeconds) ||
      !Number.isInteger(config.warningSeconds) ||
      config.warningSeconds <= 0 ||
      config.idleSeconds <= config.warningSeconds
    ) {
      throw new Error("Session idle configuration is invalid");
    }
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.expiring = false;
    this.lastActivityAt = Date.now();
    ACTIVITY_EVENTS.forEach((eventName) =>
      document.addEventListener(eventName, this.onActivity, { passive: eventName !== "keydown" })
    );
    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel("kaklen-session");
      this.channel.addEventListener("message", this.onChannelMessage);
    }
    this.ticker = window.setInterval(() => this.evaluate(), 1000);
  }

  stop(): void {
    if (!this.running) {
      return;
    }
    this.running = false;
    ACTIVITY_EVENTS.forEach((eventName) =>
      document.removeEventListener(eventName, this.onActivity)
    );
    if (this.ticker !== null) {
      window.clearInterval(this.ticker);
      this.ticker = null;
    }
    if (this.channel) {
      this.channel.removeEventListener("message", this.onChannelMessage);
      this.channel.close();
      this.channel = null;
    }
    this.warningVisible.set(false);
    this.remainingSeconds.set(0);
  }

  continueWorking(): void {
    this.registerActivity(true);
  }

  async logoutNow(reason: "manual" | "idle" = "manual"): Promise<void> {
    if (this.expiring) {
      return;
    }
    this.expiring = true;
    this.channel?.postMessage({ type: "logout", occurredAt: Date.now() } satisfies SessionChannelMessage);
    this.stop();
    this.overlays.closeAll(false);
    await this.auth.logout();
    await this.router.navigateByUrl("/login", { replaceUrl: true });
    if (reason === "idle") {
      this.notifications.warning(
        $localize`:@@sessionEndedByInactivity:La sesión finalizó por inactividad.`
      );
    }
    this.expiring = false;
  }

  formattedCountdown(): string {
    const seconds = Math.max(0, this.remainingSeconds());
    const minutesPart = Math.floor(seconds / 60).toString().padStart(2, "0");
    const secondsPart = (seconds % 60).toString().padStart(2, "0");
    return `${minutesPart}:${secondsPart}`;
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private registerActivity(broadcast: boolean): void {
    if (!this.running || this.expiring) {
      return;
    }
    this.lastActivityAt = Date.now();
    this.warningVisible.set(false);
    this.remainingSeconds.set(0);
    if (broadcast) {
      this.channel?.postMessage({ type: "activity", occurredAt: this.lastActivityAt } satisfies SessionChannelMessage);
    }
  }

  private evaluate(): void {
    if (!this.running || this.expiring) {
      return;
    }
    const elapsed = Math.floor((Date.now() - this.lastActivityAt) / 1000);
    if (elapsed >= this.config.idleSeconds) {
      void this.logoutNow("idle");
      return;
    }
    if (elapsed >= this.config.warningSeconds) {
      this.warningVisible.set(true);
      this.remainingSeconds.set(this.config.idleSeconds - elapsed);
    }
  }

  private readonly onChannelMessage = (event: MessageEvent<SessionChannelMessage>): void => {
    if (event.data.type === "activity") {
      if (event.data.occurredAt > this.lastActivityAt) {
        this.lastActivityAt = event.data.occurredAt;
        this.warningVisible.set(false);
        this.remainingSeconds.set(0);
      }
      return;
    }
    this.stop();
    this.overlays.closeAll(false);
    this.auth.clearLocalSession();
    void this.router.navigateByUrl("/login", { replaceUrl: true });
  };
}
