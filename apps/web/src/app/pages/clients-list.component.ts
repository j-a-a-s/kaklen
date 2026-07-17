import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { Client, ClientStatus, ClientSummary, ClientType, PaginatedClients } from "../clients/client.models";
import { ClientsService } from "../clients/clients.service";
import { OrganizationService } from "../organizations/organization.service";
import { EmptyStateComponent } from "../shared/empty-state.component";
import { StatusBadgeComponent } from "../shared/status-badge.component";
import { ConfirmationDialogComponent } from "../shared/confirmation-dialog.component";
import { NotificationService } from "../shared/notifications/notification.service";
import { ActionMenuComponent, ActionMenuItemDirective } from "../shared/action-menu.component";
import { UiIconComponent } from "../shared/ui-icon.component";

@Component({
  selector: "kaklen-clients-list",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, EmptyStateComponent, StatusBadgeComponent, ConfirmationDialogComponent, ActionMenuComponent, ActionMenuItemDirective, UiIconComponent],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header">
        <div>
          <p class="eyebrow" i18n="@@clientsEyebrow">Relaciones</p>
          <h1 i18n="@@clientsTitle">Clientes</h1>
          <p i18n="@@clientsDescription">Gestiona personas, empresas e interacciones por organización.</p>
        </div>
        <a
          *ngIf="canCreate()"
          class="button-link"
          [routerLink]="['/organizations', organizationId, 'clients', 'new']"
        >
          <kaklen-icon name="plus" /><span i18n="@@newClientButton">Nuevo cliente</span>
        </a>
      </section>

      <section class="summary-grid" *ngIf="summary() as currentSummary">
        <article>
          <strong>{{ currentSummary.total }}</strong>
          <small i18n="@@totalLabel">Total</small>
        </article>
        <article>
          <strong>{{ currentSummary.leads }}</strong>
          <small i18n="@@leadsLabel">Leads</small>
        </article>
        <article>
          <strong>{{ currentSummary.active }}</strong>
          <small i18n="@@activePluralLabel">Activos</small>
        </article>
        <article>
          <strong>{{ currentSummary.inactive }}</strong>
          <small i18n="@@inactivePluralLabel">Inactivos</small>
        </article>
      </section>

      <section class="dashboard-panel filters-panel">
        <form class="filters-form" role="search" [formGroup]="filtersForm" (ngSubmit)="applyFilters()">
          <div class="filter-toolbar">
            <label class="filter-search">
              <span i18n="@@searchLabel">Buscar</span>
              <input id="clients-filter-search" type="search" formControlName="search" maxlength="200" placeholder="Nombre, email o RUT" i18n-placeholder="@@clientsSearchPlaceholder" />
            </label>
            <button type="button" class="secondary filter-toggle" (click)="toggleFilters()" [attr.aria-expanded]="filtersOpen()" aria-controls="client-filter-controls">
              <span *ngIf="!filtersOpen()" i18n="@@moreFiltersButton">Más filtros</span>
              <span *ngIf="filtersOpen()" i18n="@@hideFiltersButton">Ocultar filtros</span>
            </button>
            <strong class="result-count" i18n="@@resultsCountLabel">{{ clients().total }} resultados</strong>
          </div>
          <div id="client-filter-controls" class="filter-controls" [class.open]="filtersOpen()">
            <label class="advanced-filter">
              <span i18n="@@cityLabel">Ciudad</span>
              <input id="clients-filter-city" type="search" formControlName="city" maxlength="120" />
            </label>
            <label>
              <span i18n="@@typeLabel">Tipo</span>
              <select id="clients-filter-type" formControlName="type">
                <option value="" i18n="@@allOption">Todos</option>
                <option value="NATURAL_PERSON" i18n="@@naturalPersonOption">Persona natural</option>
                <option value="LEGAL_ENTITY" i18n="@@companyOption">Empresa</option>
              </select>
            </label>
            <label>
              <span i18n="@@statusLabel">Estado</span>
              <select id="clients-filter-status" formControlName="status">
                <option value="" i18n="@@allOption">Todos</option>
                <option value="LEAD" i18n="@@leadOption">Prospecto</option>
                <option value="ACTIVE" i18n="@@activeOption">Activo</option>
                <option value="INACTIVE" i18n="@@inactiveOption">Inactivo</option>
                <option value="ARCHIVED" i18n="@@archivedOption">Archivado</option>
              </select>
            </label>
            <label class="checkbox-row advanced-filter">
              <input id="clients-filter-includeArchived" type="checkbox" formControlName="includeArchived" />
              <span i18n="@@includeArchivedLabel">Incluir archivados</span>
            </label>
            <div class="row-actions filter-actions">
              <button type="submit" [disabled]="loading()" i18n="@@filterButton">Filtrar</button>
              <button type="button" class="secondary" (click)="resetFilters()" [disabled]="loading()">
                <span i18n="@@clearFiltersButton">Limpiar filtros</span>
              </button>
            </div>
          </div>
          <div class="active-filter-chips" *ngIf="hasActiveFilters()">
            <span *ngIf="filtersForm.controls.search.value">{{ filtersForm.controls.search.value }}</span>
            <span *ngIf="filtersForm.controls.type.value">{{ typeLabel(filtersForm.controls.type.value) }}</span>
            <span *ngIf="filtersForm.controls.status.value">{{ statusLabel(filtersForm.controls.status.value) }}</span>
            <span *ngIf="filtersForm.controls.city.value">{{ filtersForm.controls.city.value }}</span>
          </div>
        </form>
      </section>

      <p class="form-error" *ngIf="error()">{{ error() }}</p>

      <section class="list-panel" *ngIf="clients().items.length > 0; else emptyState">
        <article class="item-row" *ngFor="let client of clients().items">
          <div class="entity-heading">
            <span class="entity-avatar" aria-hidden="true">{{ clientInitials(client) }}</span>
            <div>
              <strong>{{ client.displayName }}</strong>
              <div class="entity-meta">
                <kaklen-status-badge [status]="client.status" [label]="statusLabel(client.status)" />
                <small>{{ typeLabel(client.type) }}</small>
                <small *ngIf="client.city">{{ client.city }}</small>
                <small *ngIf="client.email">{{ client.email }}</small>
              </div>
            </div>
          </div>
          <div class="row-actions">
            <a [routerLink]="['/organizations', organizationId, 'clients', client.id]" i18n="@@viewLink">Ver</a>
            <a
              *ngIf="canUpdate()"
              [routerLink]="['/organizations', organizationId, 'clients', client.id, 'edit']"
            >
              <span i18n="@@editLink">Editar</span>
            </a>
            <kaklen-action-menu *ngIf="canDelete() && client.status !== 'ARCHIVED'" [contextKey]="organizationId" [showLabel]="false">
              <button kaklenMenuItem type="button" class="danger" (click)="requestArchive(client)" [disabled]="loading()"><kaklen-icon name="archive" /><span i18n="@@archiveButton">Archivar</span></button>
            </kaklen-action-menu>
          </div>
        </article>
      </section>

      <ng-template #emptyState>
        <kaklen-empty-state icon="users" [title]="clientsEmptyTitle" [description]="clientsEmptyDescription">
          <a *ngIf="canCreate()" class="button-link" [routerLink]="['/organizations', organizationId, 'clients', 'new']"><kaklen-icon name="plus" /><span i18n="@@newClientButton">Nuevo cliente</span></a>
        </kaklen-empty-state>
      </ng-template>

      <section class="pagination-row" *ngIf="clients().totalPages > 1">
        <button type="button" class="secondary" (click)="goToPage(clients().page - 1)" [disabled]="clients().page <= 1">
          <span i18n="@@previousPageButton">Anterior</span>
        </button>
        <span i18n="@@paginationLabel">Página {{ clients().page }} de {{ clients().totalPages }}</span>
        <button
          type="button"
          class="secondary"
          (click)="goToPage(clients().page + 1)"
          [disabled]="clients().page >= clients().totalPages"
        >
          <span i18n="@@nextPageButton">Siguiente</span>
        </button>
      </section>

      <kaklen-confirmation-dialog
        [open]="pendingArchive() !== null"
        [busy]="loading()"
        [title]="archiveDialogTitle"
        [description]="archiveDialogDescription"
        [confirmLabel]="archiveLabel"
        (confirm)="archive()"
        (cancel)="cancelArchive()"
      />
    </main>
  `
})
export class ClientsListComponent implements OnInit {
  readonly loading = signal(false);
  readonly error = signal("");
  readonly filtersOpen = signal(false);
  readonly pendingArchive = signal<Client | null>(null);
  readonly clientsEmptyTitle = $localize`:@@clientsEmptyTitle:Aún no tienes clientes`;
  readonly clientsEmptyDescription = $localize`:@@clientsEmpty:Crea el primero para preparar cotizaciones, registrar conversaciones y organizar eventos.`;
  readonly archiveDialogTitle = $localize`:@@archiveClientDialogTitle:Archivar cliente`;
  readonly archiveDialogDescription = $localize`:@@archiveClientDialogDescription:El cliente dejará de aparecer en los listados habituales, pero su historial se conservará.`;
  readonly archiveLabel = $localize`:@@archiveButton:Archivar`;
  readonly undoLabel = $localize`:@@undoButton:Deshacer`;
  readonly summary = signal<ClientSummary | null>(null);
  readonly clients = signal<PaginatedClients>({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0
  });
  readonly filtersForm = new FormGroup({
    search: new FormControl("", { nonNullable: true }),
    type: new FormControl<ClientType | "">("", { nonNullable: true }),
    status: new FormControl<ClientStatus | "">("", { nonNullable: true }),
    city: new FormControl("", { nonNullable: true }),
    includeArchived: new FormControl(false, { nonNullable: true })
  });
  organizationId = "";

  constructor(
    private readonly route: ActivatedRoute,
    private readonly clientsService: ClientsService,
    private readonly organizationService: OrganizationService,
    private readonly notifications: NotificationService
  ) {}

  async ngOnInit(): Promise<void> {
    this.organizationId = this.route.snapshot.paramMap.get("organizationId") ?? "";
    await this.organizationService.setActiveOrganization(this.organizationId);
    await this.load();
  }

  canCreate(): boolean {
    return this.organizationService.hasPermission("clients.create");
  }

  canUpdate(): boolean {
    return this.organizationService.hasPermission("clients.update");
  }

  canDelete(): boolean {
    return this.organizationService.hasPermission("clients.delete");
  }

  typeLabel(type: ClientType): string {
    return type === "NATURAL_PERSON" ? $localize`:@@naturalPersonLabel:Persona natural` : $localize`:@@companyLabel:Empresa`;
  }

  statusLabel(status: ClientStatus): string {
    const labels: Record<ClientStatus, string> = {
      LEAD: $localize`:@@leadLabel:Lead`,
      ACTIVE: $localize`:@@activeLabel:Activo`,
      INACTIVE: $localize`:@@inactiveLabel:Inactivo`,
      ARCHIVED: $localize`:@@archivedLabel:Archivado`
    };
    return labels[status];
  }

  clientInitials(client: Client): string {
    return client.displayName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }

  async applyFilters(): Promise<void> {
    await this.load(1);
  }

  async resetFilters(): Promise<void> {
    this.filtersForm.reset({
      search: "",
      type: "",
      status: "",
      city: "",
      includeArchived: false
    });
    await this.load(1);
  }

  toggleFilters(): void {
    this.filtersOpen.update((open) => !open);
  }

  hasActiveFilters(): boolean {
    const filters = this.filtersForm.getRawValue();
    return Boolean(filters.search || filters.type || filters.status || filters.city || filters.includeArchived);
  }

  async goToPage(page: number): Promise<void> {
    await this.load(page);
  }

  requestArchive(client: Client): void {
    this.pendingArchive.set(client);
  }

  cancelArchive(): void {
    this.pendingArchive.set(null);
  }

  async archive(): Promise<void> {
    const client = this.pendingArchive();
    if (!client || this.loading()) {
      return;
    }
    this.loading.set(true);
    this.error.set("");
    try {
      await this.clientsService.archive(this.organizationId, client.id);
      await this.load(this.clients().page);
      this.pendingArchive.set(null);
      this.notifications.success(
        $localize`:@@clientArchivedSuccess:Cliente archivado correctamente.`,
        this.undoLabel,
        () => void this.restoreClient(client)
      );
    } catch (error) {
      this.notifications.fromError(error);
      this.error.set($localize`:@@clientArchiveError:No fue posible archivar el cliente.`);
    } finally {
      this.loading.set(false);
    }
  }

  private async restoreClient(client: Client): Promise<void> {
    try {
      await this.clientsService.update(this.organizationId, client.id, { type: client.type, status: client.status });
      await this.load(this.clients().page);
      this.notifications.success($localize`:@@clientRestoredSuccess:Cliente restaurado correctamente.`);
    } catch (error) {
      this.notifications.fromError(error);
    }
  }

  private async load(page = this.clients().page): Promise<void> {
    this.loading.set(true);
    this.error.set("");
    try {
      const filters = this.filtersForm.getRawValue();
      const [summary, clients] = await Promise.all([
        this.clientsService.summary(this.organizationId),
        this.clientsService.list(this.organizationId, { ...filters, page, pageSize: 20 })
      ]);
      this.summary.set(summary);
      this.clients.set(clients);
    } catch {
      this.error.set($localize`:@@clientsLoadError:No fue posible cargar los clientes.`);
    } finally {
      this.loading.set(false);
    }
  }
}
