import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { CatalogItem, CatalogItemStatus, CatalogItemType, PaginatedCatalogItems } from "../catalog/catalog.models";
import { CatalogService } from "../catalog/catalog.service";
import { OrganizationService } from "../organizations/organization.service";

@Component({
  selector: "kaklen-catalog-list",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header">
        <div>
          <p class="eyebrow">Catálogo</p>
          <h1>Productos y servicios</h1>
          <p>Administra precios, costos, códigos y unidades por organización.</p>
        </div>
        <a
          *ngIf="canCreate()"
          class="button-link"
          [routerLink]="['/organizations', organizationId, 'catalog', 'new']"
        >
          Nuevo item
        </a>
      </section>

      <section class="dashboard-panel">
        <form [formGroup]="filtersForm" (ngSubmit)="applyFilters()">
          <div class="field-grid">
            <label>
              Buscar
              <input type="search" formControlName="search" placeholder="Nombre, código o SKU" />
            </label>
            <label>
              SKU
              <input type="search" formControlName="sku" />
            </label>
            <label>
              Código
              <input type="search" formControlName="code" />
            </label>
            <label>
              Tipo
              <select formControlName="type">
                <option value="">Todos</option>
                <option value="PRODUCT">Producto</option>
                <option value="SERVICE">Servicio</option>
              </select>
            </label>
            <label>
              Estado
              <select formControlName="status">
                <option value="">Todos</option>
                <option value="ACTIVE">Activo</option>
                <option value="INACTIVE">Inactivo</option>
                <option value="ARCHIVED">Archivado</option>
              </select>
            </label>
            <label>
              Precio mínimo
              <input type="number" min="0" step="0.01" formControlName="minPrice" />
            </label>
            <label>
              Precio máximo
              <input type="number" min="0" step="0.01" formControlName="maxPrice" />
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

      <section class="list-panel" *ngIf="catalog().items.length > 0; else emptyState">
        <article class="item-row" *ngFor="let item of catalog().items">
          <div>
            <strong>{{ item.name }}</strong>
            <small>
              {{ item.code }} · {{ typeLabel(item.type) }} · {{ statusLabel(item.status) }}
              <span *ngIf="item.sku"> · SKU {{ item.sku }}</span>
            </small>
            <small>{{ moneyLabel(item.price, item.currency) }} · {{ item.unit }}</small>
          </div>
          <div class="row-actions">
            <a [routerLink]="['/organizations', organizationId, 'catalog', item.id]">Ver</a>
            <a
              *ngIf="canUpdate()"
              [routerLink]="['/organizations', organizationId, 'catalog', item.id, 'edit']"
            >
              Editar
            </a>
            <button
              *ngIf="canDelete() && item.status !== 'ARCHIVED'"
              type="button"
              class="secondary"
              (click)="archive(item)"
              [disabled]="loading()"
            >
              Archivar
            </button>
          </div>
        </article>
      </section>

      <ng-template #emptyState>
        <section class="dashboard-panel">
          <p>No hay items para los filtros seleccionados.</p>
        </section>
      </ng-template>

      <section class="pagination-row" *ngIf="catalog().totalPages > 1">
        <button type="button" class="secondary" (click)="goToPage(catalog().page - 1)" [disabled]="catalog().page <= 1">
          Anterior
        </button>
        <span>Página {{ catalog().page }} de {{ catalog().totalPages }}</span>
        <button
          type="button"
          class="secondary"
          (click)="goToPage(catalog().page + 1)"
          [disabled]="catalog().page >= catalog().totalPages"
        >
          Siguiente
        </button>
      </section>
    </main>
  `
})
export class CatalogListComponent implements OnInit {
  readonly loading = signal(false);
  readonly error = signal("");
  readonly catalog = signal<PaginatedCatalogItems>({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0
  });
  readonly filtersForm = new FormGroup({
    search: new FormControl("", { nonNullable: true }),
    sku: new FormControl("", { nonNullable: true }),
    code: new FormControl("", { nonNullable: true }),
    type: new FormControl<CatalogItemType | "">("", { nonNullable: true }),
    status: new FormControl<CatalogItemStatus | "">("", { nonNullable: true }),
    minPrice: new FormControl<number | null>(null),
    maxPrice: new FormControl<number | null>(null),
    includeArchived: new FormControl(false, { nonNullable: true })
  });
  organizationId = "";

  constructor(
    private readonly route: ActivatedRoute,
    private readonly catalogService: CatalogService,
    private readonly organizationService: OrganizationService
  ) {}

  async ngOnInit(): Promise<void> {
    this.organizationId = this.route.snapshot.paramMap.get("organizationId") ?? "";
    await this.organizationService.setActiveOrganization(this.organizationId);
    await this.load();
  }

  canCreate(): boolean {
    return this.organizationService.hasPermission("catalog.create");
  }

  canUpdate(): boolean {
    return this.organizationService.hasPermission("catalog.update");
  }

  canDelete(): boolean {
    return this.organizationService.hasPermission("catalog.delete");
  }

  typeLabel(type: CatalogItemType): string {
    return type === "PRODUCT" ? "Producto" : "Servicio";
  }

  statusLabel(status: CatalogItemStatus): string {
    const labels: Record<CatalogItemStatus, string> = {
      ACTIVE: "Activo",
      INACTIVE: "Inactivo",
      ARCHIVED: "Archivado"
    };
    return labels[status];
  }

  moneyLabel(value: string, currency: string): string {
    return `${Number(value).toLocaleString("es-CL", { minimumFractionDigits: 2 })} ${currency}`;
  }

  async applyFilters(): Promise<void> {
    await this.load(1);
  }

  async resetFilters(): Promise<void> {
    this.filtersForm.reset({
      search: "",
      sku: "",
      code: "",
      type: "",
      status: "",
      minPrice: null,
      maxPrice: null,
      includeArchived: false
    });
    await this.load(1);
  }

  async goToPage(page: number): Promise<void> {
    await this.load(page);
  }

  async archive(item: CatalogItem): Promise<void> {
    if (!confirm(`¿Archivar ${item.name}?`)) {
      return;
    }
    this.loading.set(true);
    this.error.set("");
    try {
      await this.catalogService.archive(this.organizationId, item.id);
      await this.load(this.catalog().page);
    } catch {
      this.error.set("No fue posible archivar el item.");
    } finally {
      this.loading.set(false);
    }
  }

  private async load(page = this.catalog().page): Promise<void> {
    this.loading.set(true);
    this.error.set("");
    try {
      const filters = this.filtersForm.getRawValue();
      this.catalog.set(
        await this.catalogService.list(this.organizationId, {
          ...filters,
          minPrice: filters.minPrice ?? undefined,
          maxPrice: filters.maxPrice ?? undefined,
          page,
          pageSize: 20
        })
      );
    } catch {
      this.error.set("No fue posible cargar el catálogo.");
    } finally {
      this.loading.set(false);
    }
  }
}
