import { CommonModule } from "@angular/common";
import { Component, Input, OnChanges, OnDestroy } from "@angular/core";
import { Router } from "@angular/router";
import { ActionMenuComponent, ActionMenuItemDirective } from "../shared/action-menu.component";
import { InAppNotification, InAppNotificationsService } from "./in-app-notifications.service";

@Component({
  selector: "kaklen-notification-center",
  standalone: true,
  imports: [CommonModule, ActionMenuComponent, ActionMenuItemDirective],
  template: `
    <div class="notification-center" [attr.data-unread]="notifications.unread()">
      <kaklen-action-menu
        icon="bell"
        [label]="notificationLabel"
        [showLabel]="false"
        [badge]="notifications.unread() > 0 ? unreadLabel() : ''"
        [contextKey]="organizationId"
      >
        <div class="notification-menu-heading">
          <strong i18n="@@notificationCenterTitle">Notificaciones</strong>
          <button *ngIf="notifications.unread()" kaklenMenuItem type="button" class="ghost" (click)="markAll()" i18n="@@markAllReadButton">Marcar todas</button>
        </div>
        <p class="notification-empty" *ngIf="!notifications.loading() && notifications.items().length === 0" i18n="@@notificationEmptyState">No tienes notificaciones nuevas.</p>
        <button
          *ngFor="let item of notifications.items()"
          kaklenMenuItem
          type="button"
          class="notification-item"
          [class.unread]="!item.readAt"
          (click)="open(item)"
        >
          <span><strong>{{ title(item) }}</strong><small>{{ body(item) }}</small><time>{{ date(item.createdAt) }}</time></span>
        </button>
      </kaklen-action-menu>
    </div>
  `
})
export class NotificationCenterComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) organizationId: string | null = null;
  readonly notificationLabel = $localize`:@@notificationCenterLabel:Abrir notificaciones`;

  constructor(
    readonly notifications: InAppNotificationsService,
    private readonly router: Router
  ) {}

  ngOnChanges(): void {
    if (this.organizationId) void this.notifications.activate(this.organizationId);
    else this.notifications.deactivate();
  }

  ngOnDestroy(): void {
    this.notifications.deactivate();
  }

  unreadLabel(): string {
    return this.notifications.unread() > 99 ? "99+" : String(this.notifications.unread());
  }

  async open(item: InAppNotification): Promise<void> {
    await this.notifications.markRead(item.id);
    if (item.route) await this.router.navigateByUrl(item.route);
  }

  async markAll(): Promise<void> {
    await this.notifications.markAllRead();
  }

  title(item: InAppNotification): string {
    return notificationCopy(item.type).title;
  }

  body(item: InAppNotification): string {
    return notificationCopy(item.type).body;
  }

  date(value: string): string {
    return new Date(value).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  }
}

function notificationCopy(type: string): { title: string; body: string } {
  const copies: Record<string, { title: string; body: string }> = {
    QUOTATION_VIEWED: { title: $localize`:@@notificationQuotationViewedTitle:Cotización visualizada`, body: $localize`:@@notificationQuotationViewedBody:El cliente abrió la cotización.` },
    QUOTATION_CHANGES_REQUESTED: { title: $localize`:@@notificationChangesTitle:Cambios solicitados`, body: $localize`:@@notificationChangesBody:El cliente pidió cambios en una cotización.` },
    QUOTATION_APPROVED: { title: $localize`:@@notificationApprovedTitle:Cotización aprobada`, body: $localize`:@@notificationApprovedBody:El cliente aprobó la cotización.` },
    PAYMENT_STARTED: { title: $localize`:@@notificationPaymentStartedTitle:Pago iniciado`, body: $localize`:@@notificationPaymentStartedBody:El cliente inició un pago.` },
    PAYMENT_CONFIRMED: { title: $localize`:@@notificationPaymentConfirmedTitle:Pago confirmado`, body: $localize`:@@notificationPaymentConfirmedBody:El pago fue confirmado.` },
    PAYMENT_FAILED: { title: $localize`:@@notificationPaymentFailedTitle:Pago fallido`, body: $localize`:@@notificationPaymentFailedBody:El intento de pago no se completó.` },
    PUBLIC_LINK_EXPIRED: { title: $localize`:@@notificationLinkExpiredTitle:Enlace vencido`, body: $localize`:@@notificationLinkExpiredBody:Un enlace público venció.` },
    QUOTATION_VERSION_CREATED: { title: $localize`:@@notificationVersionTitle:Nueva versión`, body: $localize`:@@notificationVersionBody:Se creó una nueva versión de cotización.` },
    EVENT_UPCOMING: { title: $localize`:@@notificationEventUpcomingTitle:Evento próximo`, body: $localize`:@@notificationEventUpcomingBody:Hay un evento próximo.` }
  };
  return copies[type] ?? { title: $localize`:@@notificationGenericTitle:Actualización`, body: $localize`:@@notificationGenericBody:Hay una actualización disponible.` };
}
