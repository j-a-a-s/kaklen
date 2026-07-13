import { Injectable, signal } from "@angular/core";
import { API_BASE_URL, fetchRuntimeConfig, RuntimeConfig, RUNTIME_CONFIG, shortSha } from "../config/runtime-config";
import { NotificationService } from "../shared/notifications/notification.service";

interface ApiHealth {
  version: string;
  commitSha: string;
  buildTime?: string;
}

@Injectable({ providedIn: "root" })
export class VersionService {
  readonly config = signal<RuntimeConfig>(RUNTIME_CONFIG);
  readonly unavailable = signal(false);
  private readonly loadedIdentity = this.identity(RUNTIME_CONFIG);
  private intervalId: number | null = null;

  constructor(private readonly notifications: NotificationService) {}

  start(): void {
    void this.refresh();
    void this.checkApiVersion();
    if (RUNTIME_CONFIG.environment === "production" && this.intervalId === null) {
      this.intervalId = window.setInterval(() => void this.checkForNewVersion(), 300000);
    }
  }

  stop(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async refresh(): Promise<void> {
    try {
      this.config.set(await fetchRuntimeConfig(RUNTIME_CONFIG.commitSha || Date.now().toString()));
      this.unavailable.set(false);
    } catch {
      this.unavailable.set(true);
    }
  }

  async checkForNewVersion(): Promise<void> {
    try {
      const latest = await fetchRuntimeConfig(Date.now().toString());
      if (this.identity(latest) !== this.loadedIdentity) {
        this.notifications.info(
          $localize`:@@newVersionAvailable:Hay una nueva versión de Kaklen disponible.`,
          $localize`:@@updateNowButton:Actualizar ahora`,
          () => void this.reloadApplication()
        );
      }
    } catch {
      this.unavailable.set(true);
    }
  }

  async checkApiVersion(): Promise<void> {
    if (this.config().environment !== "development") {
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const health = (await response.json()) as ApiHealth;
      if (shortSha(health.commitSha) !== this.config().commitSha) {
        this.notifications.warning($localize`:@@frontendBackendVersionMismatch:Frontend y API están ejecutando versiones distintas.`);
      }
    } catch {
      return;
    }
  }

  displayVersion(): string {
    const current = this.config();
    return `Kaklen v${current.version}`;
  }

  displayCommitSha(): string {
    const commit = this.config().commitSha;
    return commit ? shortSha(commit) : "local";
  }

  displayBuildTimeValue(): string {
    const buildTime = this.config().buildTime;
    if (!buildTime) {
      return $localize`:@@versionUnavailable:Versión no disponible`;
    }
    return new Date(buildTime).toLocaleString();
  }

  displayEnvironment(): string {
    return this.config().environment;
  }

  private async reloadApplication(): Promise<void> {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    window.location.reload();
  }

  private identity(config: RuntimeConfig): string {
    return `${config.version}:${config.commitSha}`;
  }
}
