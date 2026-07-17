import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { EventsService } from "../events/events.service";
import { EventStatus, EventSummary, PaginatedEvents } from "../events/event.models";
import { formatRegionalCurrency, formatRegionalDate } from "../i18n/formatting";
import { OrganizationService } from "../organizations/organization.service";
import { EmptyStateComponent } from "../shared/empty-state.component";
import { StatusBadgeComponent } from "../shared/status-badge.component";

@Component({
  selector: "kaklen-event-list",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, EmptyStateComponent, StatusBadgeComponent],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header">
        <div>
          <p class="eyebrow" i18n="@@eventsEyebrow">Eventos</p>
          <h1 i18n="@@eventsTitle">Operaciones de eventos</h1>
          <p i18n="@@eventsDescription">Planifica eventos, tareas, recursos, participantes y cronogramas por organización.</p>
        </div>
        <div class="row-actions">
          <a class="secondary button-link" [routerLink]="['/organizations', organizationId, 'events', 'calendar']" i18n="@@eventCalendarButton">Calendario</a>
          <a *ngIf="canCreate()" class="button-link" [routerLink]="['/organizations', organizationId, 'events', 'new']" i18n="@@newEventButton">Nuevo evento</a>
        </div>
      </section>

      <section class="dashboard-panel" *ngIf="summary() as item">
        <div class="metrics-grid">
          <span><strong>{{ item.total }}</strong><small i18n="@@totalLabel">Total</small></span>
          <span><strong>{{ item.confirmed }}</strong><small i18n="@@eventConfirmedPluralLabel">Confirmados</small></span>
          <span><strong>{{ item.inProgress }}</strong><small i18n="@@inProgressLabel">En curso</small></span>
          <span><strong>{{ item.completed }}</strong><small i18n="@@eventCompletedPluralLabel">Completados</small></span>
          <span><strong>{{ item.cancelled }}</strong><small i18n="@@eventCancelledPluralLabel">Cancelados</small></span>
        </div>
      </section>

      <section class="dashboard-panel filters-panel">
        <form class="filters-form" role="search" [formGroup]="filtersForm" (ngSubmit)="load(1)">
          <div class="filter-toolbar">
            <label class="filter-search">
              <span i18n="@@searchLabel">Buscar</span>
              <input id="events-filter-search" type="search" formControlName="search" maxlength="200" placeholder="Código, nombre o cliente" i18n-placeholder="@@eventSearchPlaceholder" />
            </label>
            <button type="button" class="secondary filter-toggle" (click)="toggleFilters()" [attr.aria-expanded]="filtersOpen()" aria-controls="event-filter-controls">
              <span *ngIf="!filtersOpen()" i18n="@@filtersButton">Filtros</span>
              <span *ngIf="filtersOpen()" i18n="@@hideFiltersButton">Ocultar filtros</span>
            </button>
            <strong class="result-count" i18n="@@resultsCountLabel">{{ events().total }} resultados</strong>
          </div>
          <div id="event-filter-controls" class="filter-controls" [class.open]="filtersOpen()">
            <label>
              <span i18n="@@statusLabel">Estado</span>
              <select id="events-filter-status" formControlName="status">
                <option value="" i18n="@@allOption">Todos</option>
                <option value="DRAFT" i18n="@@draftLabel">Borrador</option>
                <option value="CONFIRMED" i18n="@@confirmedLabel">Confirmado</option>
                <option value="IN_PROGRESS" i18n="@@inProgressLabel">En curso</option>
                <option value="COMPLETED" i18n="@@eventCompletedLabel">Completado</option>
                <option value="CANCELLED" i18n="@@eventCancelledLabel">Cancelado</option>
              </select>
            </label>
            <label class="advanced-filter">
              <span i18n="@@cityLabel">Ciudad</span>
              <input id="events-filter-city" type="search" formControlName="city" maxlength="120" />
            </label>
          <div class="row-actions filter-actions">
            <button type="submit" [disabled]="loading()" i18n="@@filterButton">Filtrar</button>
            <button type="button" class="secondary" (click)="resetFilters()" [disabled]="loading()" i18n="@@clearFiltersButton">Limpiar filtros</button>
          </div>
          </div>
          <div class="active-filter-chips" *ngIf="filtersForm.controls.search.value || filtersForm.controls.status.value || filtersForm.controls.city.value">
            <span *ngIf="filtersForm.controls.search.value">{{ filtersForm.controls.search.value }}</span>
            <span *ngIf="filtersForm.controls.status.value">{{ statusLabel(filtersForm.controls.status.value) }}</span>
            <span *ngIf="filtersForm.controls.city.value">{{ filtersForm.controls.city.value }}</span>
          </div>
        </form>
      </section>

      <p class="form-error" *ngIf="error()">{{ error() }}</p>

      <section class="list-panel" *ngIf="events().items.length > 0; else emptyState">
        <article class="item-row" *ngFor="let event of events().items">
          <div class="entity-heading">
            <span class="entity-avatar square event-date" aria-hidden="true">{{ dayLabel(event.startAt) }}</span>
            <div>
              <strong>{{ event.code }} · {{ event.name }}</strong>
              <div class="entity-meta">
                <kaklen-status-badge [status]="event.status" [label]="statusLabel(event.status)" />
                <small>{{ dateLabel(event.startAt) }}</small>
                <small>{{ event.client?.displayName || emptyClientLabel }}</small>
                <small *ngIf="event.budget" class="entity-price">{{ moneyLabel(event.budget, event.currency) }}</small>
              </div>
            </div>
          </div>
          <div class="row-actions">
            <a [routerLink]="['/organizations', organizationId, 'events', event.id]" i18n="@@viewLink">Ver</a>
            <a *ngIf="canUpdate()" [routerLink]="['/organizations', organizationId, 'events', event.id, 'edit']" i18n="@@editLink">Editar</a>
          </div>
        </article>
      </section>

      <ng-template #emptyState>
        <kaklen-empty-state icon="calendar" [title]="eventsEmptyTitle" [description]="eventsEmptyDescription">
          <a *ngIf="canCreate()" class="button-link" [routerLink]="['/organizations', organizationId, 'events', 'new']" i18n="@@newEventButton">Nuevo evento</a>
        </kaklen-empty-state>
      </ng-template>

      <section class="pagination-row" *ngIf="events().totalPages > 1">
        <button type="button" class="secondary" (click)="load(events().page - 1)" [disabled]="events().page <= 1" i18n="@@previousPageButton">Anterior</button>
        <span i18n="@@paginationLabel">Página {{ events().page }} de {{ events().totalPages }}</span>
        <button type="button" class="secondary" (click)="load(events().page + 1)" [disabled]="events().page >= events().totalPages" i18n="@@nextPageButton">Siguiente</button>
      </section>
    </main>
  `
})
export class EventListComponent implements OnInit {
  readonly loading = signal(false);
  readonly error = signal("");
  readonly filtersOpen = signal(false);
  readonly eventsEmptyTitle = $localize`:@@eventsEmptyTitle:Organiza tu primer evento`;
  readonly eventsEmptyDescription = $localize`:@@eventsEmpty:Crea uno manualmente o parte desde una cotización aprobada para coordinar tareas y recursos.`;
  readonly summary = signal<EventSummary | null>(null);
  readonly events = signal<PaginatedEvents>({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 });
  readonly filtersForm = new FormGroup({
    search: new FormControl("", { nonNullable: true }),
    status: new FormControl<EventStatus | "">("", { nonNullable: true }),
    city: new FormControl("", { nonNullable: true })
  });
  readonly emptyClientLabel = $localize`:@@noClientLabel:Sin cliente`;
  organizationId = "";

  constructor(
    private readonly route: ActivatedRoute,
    private readonly organizationService: OrganizationService,
    private readonly eventsService: EventsService
  ) {}

  async ngOnInit(): Promise<void> {
    this.organizationId = this.route.snapshot.paramMap.get("organizationId") ?? "";
    await this.organizationService.setActiveOrganization(this.organizationId);
    await this.load(1);
  }

  canCreate(): boolean {
    return this.organizationService.hasPermission("events.create");
  }

  canUpdate(): boolean {
    return this.organizationService.hasPermission("events.update");
  }

  async load(page: number): Promise<void> {
    this.loading.set(true);
    this.error.set("");
    try {
      this.summary.set(await this.eventsService.summary(this.organizationId));
      this.events.set(await this.eventsService.list(this.organizationId, { ...this.filtersForm.getRawValue(), page }));
    } catch {
      this.error.set($localize`:@@eventsLoadError:No fue posible cargar los eventos.`);
    } finally {
      this.loading.set(false);
    }
  }

  async resetFilters(): Promise<void> {
    this.filtersForm.reset({ search: "", status: "", city: "" });
    await this.load(1);
  }

  toggleFilters(): void {
    this.filtersOpen.update((open) => !open);
  }

  statusLabel(status: EventStatus): string {
    const labels: Record<EventStatus, string> = {
      DRAFT: $localize`:@@draftLabel:Borrador`,
      CONFIRMED: $localize`:@@confirmedLabel:Confirmado`,
      IN_PROGRESS: $localize`:@@inProgressLabel:En curso`,
      COMPLETED: $localize`:@@eventCompletedLabel:Completado`,
      CANCELLED: $localize`:@@eventCancelledLabel:Cancelado`,
      ARCHIVED: $localize`:@@archivedLabel:Archivado`
    };
    return labels[status];
  }

  dateLabel(value: string): string {
    const organization = this.organizationService.activeOrganization();
    return formatRegionalDate(value, {
      dateFormat: organization?.dateFormat ?? "dd-MM-yyyy",
      numberFormat: organization?.numberFormat ?? "es"
    });
  }

  dayLabel(value: string): string {
    return new Intl.DateTimeFormat("es", { day: "2-digit" }).format(new Date(value));
  }

  moneyLabel(value: string, currency: string): string {
    const organization = this.organizationService.activeOrganization();
    return formatRegionalCurrency(value, { currency, numberFormat: organization?.numberFormat ?? "es" });
  }
}
