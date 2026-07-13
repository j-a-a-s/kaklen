import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { NotificationService } from "./notification.service";

@Component({
  selector: "kaklen-notification-container",
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="toast-region" aria-live="polite" aria-label="Notificaciones" i18n-aria-label="@@notificationsAriaLabel">
      <article
        *ngFor="let notification of notifications.notifications()"
        class="toast"
        [class.success]="notification.kind === 'success'"
        [class.error]="notification.kind === 'error'"
        [class.warning]="notification.kind === 'warning'"
        [class.info]="notification.kind === 'info'"
        role="status"
      >
        <span>{{ notification.message }}</span>
        <button type="button" class="toast-close" (click)="notifications.dismiss(notification.id)" aria-label="Cerrar" i18n-aria-label="@@closeNotificationLabel">×</button>
      </article>
    </section>
  `
})
export class NotificationContainerComponent {
  constructor(readonly notifications: NotificationService) {}
}
