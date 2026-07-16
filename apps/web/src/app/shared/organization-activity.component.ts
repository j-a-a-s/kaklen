import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { RouterLink } from "@angular/router";
import { OrganizationActivityItem } from "../assistant/assistant.models";

@Component({
  selector: "kaklen-organization-activity",
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="activity-feed" aria-label="Actividad reciente" i18n-aria-label="@@recentActivityTitle">
      <article *ngFor="let item of items; trackBy: trackById">
        <span class="activity-marker" aria-hidden="true"></span>
        <div>
          <p><strong>{{ item.actor.name }}</strong> {{ actionLabel(item.action) }} <a [routerLink]="item.resource.route">{{ item.resource.title }}</a></p>
          <small>{{ relativeDate(item.occurredAt) }}</small>
        </div>
      </article>
      <p class="empty-inline" *ngIf="items.length === 0" i18n="@@noRecentActivity">La actividad aparecerá aquí cuando tu equipo empiece a trabajar.</p>
    </section>
  `
})
export class OrganizationActivityComponent {
  @Input({ required: true }) items: OrganizationActivityItem[] = [];

  trackById(_index: number, item: OrganizationActivityItem): string {
    return item.id;
  }

  actionLabel(action: string): string {
    const labels: Readonly<Record<string, string>> = {
      "client.created": $localize`:@@activityClientCreated:creó al cliente`,
      "client.updated": $localize`:@@activityClientUpdated:actualizó al cliente`,
      "catalog_item.created": $localize`:@@activityCatalogCreated:agregó al catálogo`,
      "catalog_item.updated": $localize`:@@activityCatalogUpdated:actualizó`,
      "quotation.created": $localize`:@@activityQuotationCreated:creó la cotización`,
      "quotation.sent": $localize`:@@activityQuotationSent:envió la cotización`,
      "quotation.approved": $localize`:@@activityQuotationApproved:aprobó la cotización`,
      "quotation.rejected": $localize`:@@activityQuotationRejected:rechazó la cotización`,
      "event.created": $localize`:@@activityEventCreated:creó el evento`,
      "event.completed": $localize`:@@activityEventCompleted:completó el evento`,
      "organization.updated": $localize`:@@activityOrganizationUpdated:actualizó la organización`
    };
    return labels[action] ?? $localize`:@@activityUpdated:actualizó`;
  }

  relativeDate(value: string): string {
    const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
    const formatter = new Intl.RelativeTimeFormat($localize.locale ?? "es", { numeric: "auto" });
    if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
    const minutes = Math.round(seconds / 60);
    if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
    return formatter.format(Math.round(hours / 24), "day");
  }
}
