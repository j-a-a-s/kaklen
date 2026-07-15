import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { Client, ClientStatus, ClientSummary, ClientType, PaginatedClients } from "../clients/client.models";
import { ClientsService } from "../clients/clients.service";
import { OrganizationService } from "../organizations/organization.service";
import { EmptyStateComponent } from "../shared/empty-state.component";
import { StatusBadgeComponent } from "../shared/status-badge.component";

@Component({
  selector: "kaklen-clients-list",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, EmptyStateComponent, StatusBadgeComponent],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header">
        <div>
          <p class="eyebrow" i18n="@@crmEyebrow">CRM</p>
          <h1 i18n="@@clientsTitle">Clientes</h1>
          <p i18n="@@clientsDescription">Gestiona personas, empresas e interacciones por organización.</p>
        </div>
        <a
          *ngIf="canCreate()"
          class="button-link"
          [routerLink]="['/organizations', organizationId, 'clients', 'new']"
        >
          <span i18n="@@newClientButton">Nuevo cliente</span>
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

      <section class="dashboard-panel">
        <form [formGroup]="filtersForm" (ngSubmit)="applyFilters()">
          <div class="field-grid">
            <label>
              <span i18n="@@searchLabel">Buscar</span>
              <input type="search" formControlName="search" placeholder="Nombre, email o RUT" i18n-placeholder="@@clientsSearchPlaceholder" />
            </label>
            <label>
              <span i18n="@@cityLabel">Ciudad</span>
              <input type="search" formControlName="city" />
            </label>
            <label>
              <span i18n="@@typeLabel">Tipo</span>
              <select formControlName="type">
                <option value="" i18n="@@allOption">Todos</option>
                <option value="NATURAL_PERSON" i18n="@@naturalPersonOption">Persona natural</option>
                <option value="LEGAL_ENTITY" i18n="@@companyOption">Empresa</option>
              </select>
            </label>
            <label>
              <span i18n="@@statusLabel">Estado</span>
              <select formControlName="status">
                <option value="" i18n="@@allOption">Todos</option>
                <option value="LEAD" i18n="@@leadOption">Lead</option>
                <option value="ACTIVE" i18n="@@activeOption">Activo</option>
                <option value="INACTIVE" i18n="@@inactiveOption">Inactivo</option>
                <option value="ARCHIVED" i18n="@@archivedOption">Archivado</option>
              </select>
            </label>
          </div>
          <label class="checkbox-row">
            <input type="checkbox" formControlName="includeArchived" />
            <span i18n="@@includeArchivedLabel">Incluir archivados</span>
          </label>
          <div class="row-actions">
            <button type="submit" [disabled]="loading()" i18n="@@filterButton">Filtrar</button>
            <button type="button" class="secondary" (click)="resetFilters()" [disabled]="loading()">
              <span i18n="@@clearButton">Limpiar</span>
            </button>
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
            <button
              *ngIf="canDelete() && client.status !== 'ARCHIVED'"
              type="button"
              class="secondary"
              (click)="archive(client)"
              [disabled]="loading()"
            >
              <span i18n="@@archiveButton">Archivar</span>
            </button>
          </div>
        </article>
      </section>

      <ng-template #emptyState>
        <kaklen-empty-state icon="◎" [title]="clientsEmptyTitle" [description]="clientsEmptyDescription">
          <a *ngIf="canCreate()" class="button-link" [routerLink]="['/organizations', organizationId, 'clients', 'new']" i18n="@@newClientButton">Nuevo cliente</a>
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
    </main>
  `
})
export class ClientsListComponent implements OnInit {
  readonly loading = signal(false);
  readonly error = signal("");
  readonly clientsEmptyTitle = $localize`:@@clientsEmptyTitle:Aún no hay clientes aquí`;
  readonly clientsEmptyDescription = $localize`:@@clientsEmpty:Agrega tu primer cliente o ajusta los filtros para encontrarlo.`;
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
    private readonly organizationService: OrganizationService
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

  async goToPage(page: number): Promise<void> {
    await this.load(page);
  }

  async archive(client: Client): Promise<void> {
    if (!confirm($localize`:@@archiveClientConfirm:¿Archivar a ${client.displayName}?`)) {
      return;
    }
    this.loading.set(true);
    this.error.set("");
    try {
      await this.clientsService.archive(this.organizationId, client.id);
      await this.load(this.clients().page);
    } catch {
      this.error.set($localize`:@@clientArchiveError:No fue posible archivar el cliente.`);
    } finally {
      this.loading.set(false);
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
