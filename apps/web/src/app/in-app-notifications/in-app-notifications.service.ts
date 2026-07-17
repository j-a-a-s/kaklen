import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { API_BASE_URL } from "../config/runtime-config";

export interface InAppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  resourceType: string;
  resourceId: string | null;
  route: string | null;
  readAt: string | null;
  createdAt: string;
}

const BACKGROUND_HEADERS = new HttpHeaders({ "X-Kaklen-Background": "true" });

@Injectable({ providedIn: "root" })
export class InAppNotificationsService {
  readonly items = signal<InAppNotification[]>([]);
  readonly unread = signal(0);
  readonly loading = signal(false);
  private organizationId: string | null = null;
  private pollTimer: number | null = null;
  private channel: BroadcastChannel | null = null;

  constructor(private readonly http: HttpClient) {}

  activate(organizationId: string): Promise<void> {
    if (this.organizationId === organizationId && this.pollTimer !== null) return Promise.resolve();
    this.deactivate();
    this.organizationId = organizationId;
    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel("kaklen.notifications");
      this.channel.onmessage = () => void this.refresh(true);
    }
    const initialRefresh = this.refresh();
    this.pollTimer = window.setInterval(() => void this.refresh(true), 30000);
    return initialRefresh;
  }

  deactivate(): void {
    if (this.pollTimer !== null) window.clearInterval(this.pollTimer);
    this.pollTimer = null;
    this.channel?.close();
    this.channel = null;
    this.organizationId = null;
    this.items.set([]);
    this.unread.set(0);
    this.loading.set(false);
  }

  async refresh(background = false): Promise<void> {
    const organizationId = this.organizationId;
    if (!organizationId) return;
    if (!background) this.loading.set(true);
    try {
      const [items, unread] = await Promise.all([
        firstValueFrom(this.http.get<InAppNotification[]>(
          `${API_BASE_URL}/organizations/${organizationId}/notifications`,
          { headers: BACKGROUND_HEADERS, withCredentials: true }
        )),
        firstValueFrom(this.http.get<{ count: number }>(
          `${API_BASE_URL}/organizations/${organizationId}/notifications/unread-count`,
          { headers: BACKGROUND_HEADERS, withCredentials: true }
        ))
      ]);
      if (this.organizationId === organizationId) {
        this.items.set(items);
        this.unread.set(unread.count);
      }
    } finally {
      if (!background) this.loading.set(false);
    }
  }

  async markRead(notificationId: string): Promise<void> {
    if (!this.organizationId) return;
    await firstValueFrom(this.http.patch(
      `${API_BASE_URL}/organizations/${this.organizationId}/notifications/${notificationId}/read`,
      {},
      { withCredentials: true }
    ));
    this.items.update((items) => items.map((item) =>
      item.id === notificationId && !item.readAt ? { ...item, readAt: new Date().toISOString() } : item
    ));
    this.unread.update((count) => Math.max(0, count - 1));
    this.channel?.postMessage("refresh");
  }

  async markAllRead(): Promise<void> {
    if (!this.organizationId) return;
    await firstValueFrom(this.http.patch(
      `${API_BASE_URL}/organizations/${this.organizationId}/notifications/read-all`,
      {},
      { withCredentials: true }
    ));
    const readAt = new Date().toISOString();
    this.items.update((items) => items.map((item) => ({ ...item, readAt: item.readAt ?? readAt })));
    this.unread.set(0);
    this.channel?.postMessage("refresh");
  }
}
