import { Injectable, signal } from "@angular/core";

export type NotificationKind = "success" | "error" | "warning" | "info";

export interface AppNotification {
  id: number;
  kind: NotificationKind;
  message: string;
  durationMs: number;
}

const DURATIONS: Record<NotificationKind, number> = {
  success: 3000,
  info: 4000,
  warning: 5000,
  error: 7000
};

@Injectable({ providedIn: "root" })
export class NotificationService {
  readonly notifications = signal<AppNotification[]>([]);
  private nextId = 1;
  private lastMessage = "";

  success(message: string): void {
    this.show("success", message);
  }

  error(message: string): void {
    this.show("error", message);
  }

  warning(message: string): void {
    this.show("warning", message);
  }

  info(message: string): void {
    this.show("info", message);
  }

  fromError(error: unknown): void {
    this.error(messageForError(error));
    if (isDevelopment() && error) {
      console.error(error);
    }
  }

  dismiss(id: number): void {
    this.notifications.update((items) => items.filter((item) => item.id !== id));
  }

  private show(kind: NotificationKind, message: string): void {
    if (message === this.lastMessage) {
      return;
    }
    this.lastMessage = message;
    const notification: AppNotification = {
      id: this.nextId,
      kind,
      message,
      durationMs: DURATIONS[kind]
    };
    this.nextId += 1;
    this.notifications.update((items) => [...items, notification]);
    window.setTimeout(() => {
      this.dismiss(notification.id);
      if (this.lastMessage === message) {
        this.lastMessage = "";
      }
    }, notification.durationMs);
  }
}

export function messageForError(error: unknown): string {
  const code = backendErrorCode(error);
  const messages: Record<string, string> = {
    VALIDATION_ERROR: $localize`:@@errorValidation:Revisa los datos ingresados.`,
    RUT_INVALID: $localize`:@@errorRutInvalid:Ingresa un RUT válido.`,
    RESOURCE_NOT_FOUND: $localize`:@@errorResourceNotFound:No encontramos el recurso solicitado.`,
    NOT_FOUND: $localize`:@@errorResourceNotFound:No encontramos el recurso solicitado.`,
    FORBIDDEN: $localize`:@@errorForbidden:No tienes permiso para realizar esta acción.`,
    CONFLICT: $localize`:@@errorConflict:La operación entra en conflicto con información existente.`,
    DUPLICATE_TAX_ID: $localize`:@@errorDuplicateTaxId:Ya existe un registro con ese RUT.`,
    QUOTATION_INVALID_STATUS: $localize`:@@errorQuotationInvalidStatus:La cotización no permite esa acción en su estado actual.`,
    EVENT_INVALID_STATUS: $localize`:@@errorEventInvalidStatus:El evento no permite esa acción en su estado actual.`
  };

  return messages[code] ?? $localize`:@@errorFallback:No fue posible completar la operación.`;
}

function backendErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "error" in error) {
    const body = (error as { error?: unknown }).error;
    if (body && typeof body === "object" && "code" in body && typeof body.code === "string") {
      return body.code;
    }
  }
  return "";
}

function isDevelopment(): boolean {
  return typeof location !== "undefined" && location.hostname === "localhost";
}
