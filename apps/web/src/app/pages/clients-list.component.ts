import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { Client, ClientStatus, ClientSummary, ClientType, PaginatedClients } from "../clients/client.models";
import { ClientsService } from "../clients/clients.service";
import { OrganizationService } from "../organizations/organization.service";

@Component({
  selector: "kaklen-clients-list",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header">
        <div>
          <p class="eyebrow">CRM</p>
          <h1>Clientes</h1>
          <p>Gestiona personas, empresas e interacciones por organización.</p>
        </div>
        <a
          *ngIf="canCreate()"
          class="button-link"
          [routerLink]="['/organizations', organizationId, 'clients', 'new']"
        >
          Nuevo cliente
        </a>
      </section>

      <section class="summary-grid" *ngIf="summary() as currentSummary">
        <article>
          <strong>{{ currentSummary.total }}</strong>
          <small>Total</small>
        </article>
        <article>
          <strong>{{ currentSummary.leads }}</strong>
          <small>Leads</small>
        </article>
        <article>
          <strong>{{ currentSummary.active }}</strong>
          <small>Activos</small>
        </article>
        <article>
          <strong>{{ currentSummary.inactive }}</strong>
          <small>Inactivos</small>
        </article>
      </section>

      <section class="dashboard-panel">
        <form [formGroup]="filtersForm" (ngSubmit)="applyFilters()">
          <div class="field-grid">
            <label>
              Buscar
              <input type="search" formControlName="search" placeholder="Nombre, email o RUT" />
            </label>
            <label>
              Ciudad
              <input type="search" formControlName="city" />
            </label>
            <label>
              Tipo
              <select formControlName="type">
                <option value="">Todos</option>
                <option value="NATURAL_PERSON">Persona natural</option>
                <option value="LEGAL_ENTITY">Empresa</option>
              </select>
            </label>
            <label>
              Estado
              <select formControlName="status">
                <option value="">Todos</option>
                <option value="LEAD">Lead</option>
                <option value="ACTIVE">Activo</option>
                <option value="INACTIVE">Inactivo</option>
                <option value="ARCHIVED">Archivado</option>
              </select>
            </label>
          </div>
          <label class="checkbox-row">
            <input type="checkbox" formControlName="includeArchived" />
            Incluir archivados
          </label>
          <div class="row-actions">
            <button type="submit" [disabled]="loading()">Filtrar</button>
            <button type="button" class="secondary" (click)="resetFilters()" [disabled]="loading()">
              Limpiar
            </button>
          </div>
        </form>
      </section>

      <p class="form-error" *ngIf="error()">{{ error() }}</p>

      <section class="list-panel" *ngIf="clients().items.length > 0; else emptyState">
        <article class="item-row" *ngFor="let client of clients().items">
          <div>
            <strong>{{ client.displayName }}</strong>
            <small>
              {{ typeLabel(client.type) }} · {{ statusLabel(client.status) }}
              <span *ngIf="client.city"> · {{ client.city }}</span>
              <span *ngIf="client.email"> · {{ client.email }}</span>
            </small>
          </div>
          <div class="row-actions">
            <a [routerLink]="['/organizations', organizationId, 'clients', client.id]">Ver</a>
            <a
              *ngIf="canUpdate()"
              [routerLink]="['/organizations', organizationId, 'clients', client.id, 'edit']"
            >
              Editar
            </a>
            <button
              *ngIf="canDelete() && client.status !== 'ARCHIVED'"
              type="button"
              class="secondary"
              (click)="archive(client)"
              [disabled]="loading()"
            >
              Archivar
            </button>
          </div>
        </article>
      </section>

      <ng-template #emptyState>
        <section class="dashboard-panel">
          <p>No hay clientes para los filtros seleccionados.</p>
        </section>
      </ng-template>

      <section class="pagination-row" *ngIf="clients().totalPages > 1">
        <button type="button" class="secondary" (click)="goToPage(clients().page - 1)" [disabled]="clients().page <= 1">
          Anterior
        </button>
        <span>Página {{ clients().page }} de {{ clients().totalPages }}</span>
        <button
          type="button"
          class="secondary"
          (click)="goToPage(clients().page + 1)"
          [disabled]="clients().page >= clients().totalPages"
        >
          Siguiente
        </button>
      </section>
    </main>
  `
})
export class ClientsListComponent implements OnInit {
  readonly loading = signal(false);
  readonly error = signal("");
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
    return type === "NATURAL_PERSON" ? "Persona natural" : "Empresa";
  }

  statusLabel(status: ClientStatus): string {
    const labels: Record<ClientStatus, string> = {
      LEAD: "Lead",
      ACTIVE: "Activo",
      INACTIVE: "Inactivo",
      ARCHIVED: "Archivado"
    };
    return labels[status];
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
    if (!confirm(`¿Archivar a ${client.displayName}?`)) {
      return;
    }
    this.loading.set(true);
    this.error.set("");
    try {
      await this.clientsService.archive(this.organizationId, client.id);
      await this.load(this.clients().page);
    } catch {
      this.error.set("No fue posible archivar el cliente.");
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
      this.error.set("No fue posible cargar los clientes.");
    } finally {
      this.loading.set(false);
    }
  }
}
