import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { CatalogItem, CatalogItemStatus, CatalogItemType, PaginatedCatalogItems } from "../catalog/catalog.models";
import { CatalogService } from "../catalog/catalog.service";
import { formatRegionalCurrency } from "../i18n/formatting";
import { OrganizationService } from "../organizations/organization.service";
import { NotificationService } from "../shared/notifications/notification.service";
import { EmptyStateComponent } from "../shared/empty-state.component";
import { StatusBadgeComponent } from "../shared/status-badge.component";
import { ConfirmationDialogComponent } from "../shared/confirmation-dialog.component";
import { ActionMenuComponent, ActionMenuItemDirective } from "../shared/action-menu.component";
import { UiIconComponent } from "../shared/ui-icon.component";

@Component({
  selector: "kaklen-catalog-list",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, EmptyStateComponent, StatusBadgeComponent, ConfirmationDialogComponent, ActionMenuComponent, ActionMenuItemDirective, UiIconComponent],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header">
        <div>
          <p class="eyebrow" i18n="@@catalogEyebrow">Catálogo</p>
          <h1 i18n="@@catalogTitle">Productos y servicios</h1>
          <p i18n="@@catalogDescription">Administra precios, costos, códigos y unidades por organización.</p>
        </div>
        <a
          *ngIf="canCreate()"
          class="button-link"
          [routerLink]="['/organizations', organizationId, 'catalog', 'new']"
        >
          <kaklen-icon name="plus" /><span i18n="@@newCatalogItemButton">Nuevo producto o servicio</span>
        </a>
      </section>

      <section class="dashboard-panel filters-panel">
        <form class="filters-form" role="search" [formGroup]="filtersForm" (ngSubmit)="applyFilters()">
          <div class="filter-toolbar">
            <label class="filter-search">
              <span i18n="@@searchLabel">Buscar</span>
              <input type="search" formControlName="search" maxlength="160" placeholder="Nombre, código o SKU" i18n-placeholder="@@catalogSearchPlaceholder" />
            </label>
            <button type="button" class="secondary filter-toggle" (click)="toggleFilters()" [attr.aria-expanded]="filtersOpen()" aria-controls="catalog-filter-controls">
              <span *ngIf="!filtersOpen()" i18n="@@moreFiltersButton">Más filtros</span>
              <span *ngIf="filtersOpen()" i18n="@@hideFiltersButton">Ocultar filtros</span>
            </button>
            <strong class="result-count" i18n="@@resultsCountLabel">{{ catalog().total }} resultados</strong>
          </div>
          <div id="catalog-filter-controls" class="filter-controls" [class.open]="filtersOpen()">
            <label class="advanced-filter">
              <span i18n="@@skuLabel">SKU</span>
              <input type="search" formControlName="sku" maxlength="80" />
            </label>
            <label class="advanced-filter">
              <span i18n="@@codeLabel">Código</span>
              <input type="search" formControlName="code" maxlength="80" />
            </label>
            <label>
              <span i18n="@@typeLabel">Tipo</span>
              <select formControlName="type">
                <option value="" i18n="@@allOption">Todos</option>
                <option value="PRODUCT" i18n="@@productOption">Producto</option>
                <option value="SERVICE" i18n="@@serviceOption">Servicio</option>
              </select>
            </label>
            <label>
              <span i18n="@@statusLabel">Estado</span>
              <select formControlName="status">
                <option value="" i18n="@@allOption">Todos</option>
                <option value="ACTIVE" i18n="@@activeOption">Activo</option>
                <option value="INACTIVE" i18n="@@inactiveOption">Inactivo</option>
                <option value="ARCHIVED" i18n="@@archivedOption">Archivado</option>
              </select>
            </label>
            <label class="advanced-filter">
              <span i18n="@@minPriceLabel">Precio mínimo</span>
              <input type="number" inputmode="decimal" min="0" step="0.01" formControlName="minPrice" />
            </label>
            <label class="advanced-filter">
              <span i18n="@@maxPriceLabel">Precio máximo</span>
              <input type="number" inputmode="decimal" min="0" step="0.01" formControlName="maxPrice" />
            </label>
            <label class="checkbox-row advanced-filter">
              <input type="checkbox" formControlName="includeArchived" />
              <span i18n="@@includeArchivedLabel">Incluir archivados</span>
            </label>
            <div class="row-actions filter-actions">
              <button type="submit" [disabled]="loading()" i18n="@@filterButton">Filtrar</button>
              <button type="button" class="secondary" (click)="resetFilters()" [disabled]="loading()" i18n="@@clearFiltersButton">Limpiar filtros</button>
            </div>
          </div>
          <div class="active-filter-chips" *ngIf="hasActiveFilters()">
            <span *ngIf="filtersForm.controls.search.value">{{ filtersForm.controls.search.value }}</span>
            <span *ngIf="filtersForm.controls.type.value">{{ typeLabel(filtersForm.controls.type.value) }}</span>
            <span *ngIf="filtersForm.controls.status.value">{{ statusLabel(filtersForm.controls.status.value) }}</span>
            <span *ngIf="filtersForm.controls.sku.value">SKU {{ filtersForm.controls.sku.value }}</span>
          </div>
        </form>
      </section>

      <p class="form-error" *ngIf="error()">{{ error() }}</p>

      <section class="list-panel" *ngIf="catalog().items.length > 0; else emptyState">
        <article class="item-row" *ngFor="let item of catalog().items">
          <div class="entity-heading">
            <span class="entity-avatar square" aria-hidden="true">{{ item.type === 'PRODUCT' ? 'P' : 'S' }}</span>
            <div>
              <strong>{{ item.name }}</strong>
              <div class="entity-meta">
                <kaklen-status-badge [status]="item.status" [label]="statusLabel(item.status)" />
                <small>{{ typeLabel(item.type) }}</small>
                <small>{{ item.code }}</small>
                <small *ngIf="item.sku" i18n="@@skuInlineLabel">SKU {{ item.sku }}</small>
              </div>
              <small class="entity-price">{{ moneyLabel(item.price, item.currency) }} · {{ item.unit }}</small>
            </div>
          </div>
          <div class="row-actions">
            <a [routerLink]="['/organizations', organizationId, 'catalog', item.id]" i18n="@@viewLink">Ver</a>
            <a
              *ngIf="canUpdate()"
              [routerLink]="['/organizations', organizationId, 'catalog', item.id, 'edit']"
            >
              <span i18n="@@editLink">Editar</span>
            </a>
            <kaklen-action-menu *ngIf="canDelete() && item.status !== 'ARCHIVED'" [contextKey]="organizationId" [showLabel]="false">
              <button kaklenMenuItem type="button" class="danger" (click)="requestArchive(item)" [disabled]="loading()"><kaklen-icon name="archive" /><span i18n="@@archiveButton">Archivar</span></button>
            </kaklen-action-menu>
          </div>
        </article>
      </section>

      <ng-template #emptyState>
        <kaklen-empty-state icon="package" [title]="catalogEmptyTitle" [description]="catalogEmptyDescription">
          <a *ngIf="canCreate()" class="button-link" [routerLink]="['/organizations', organizationId, 'catalog', 'new']"><kaklen-icon name="plus" /><span i18n="@@newCatalogItemButton">Nuevo producto o servicio</span></a>
        </kaklen-empty-state>
      </ng-template>

      <section class="pagination-row" *ngIf="catalog().totalPages > 1">
        <button type="button" class="secondary" (click)="goToPage(catalog().page - 1)" [disabled]="catalog().page <= 1">
          <span i18n="@@previousPageButton">Anterior</span>
        </button>
        <span i18n="@@paginationLabel">Página {{ catalog().page }} de {{ catalog().totalPages }}</span>
        <button
          type="button"
          class="secondary"
          (click)="goToPage(catalog().page + 1)"
          [disabled]="catalog().page >= catalog().totalPages"
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
        (cancel)="pendingArchive.set(null)"
      />
    </main>
  `
})
export class CatalogListComponent implements OnInit {
  readonly loading = signal(false);
  readonly error = signal("");
  readonly filtersOpen = signal(false);
  readonly pendingArchive = signal<CatalogItem | null>(null);
  readonly catalogEmptyTitle = $localize`:@@catalogEmptyTitle:Agrega tus productos y servicios`;
  readonly catalogEmptyDescription = $localize`:@@catalogEmpty:Guarda precios, unidades e impuestos para preparar cotizaciones más rápido.`;
  readonly archiveDialogTitle = $localize`:@@archiveCatalogDialogTitle:Archivar producto o servicio`;
  readonly archiveDialogDescription = $localize`:@@archiveCatalogDialogDescription:El elemento dejará de estar disponible para nuevas cotizaciones, pero seguirá visible en los registros históricos.`;
  readonly archiveLabel = $localize`:@@archiveButton:Archivar`;
  readonly undoLabel = $localize`:@@undoButton:Deshacer`;
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
    private readonly organizationService: OrganizationService,
    private readonly notifications: NotificationService
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
    return type === "PRODUCT" ? $localize`:@@productLabel:Producto` : $localize`:@@serviceLabel:Servicio`;
  }

  statusLabel(status: CatalogItemStatus): string {
    const labels: Record<CatalogItemStatus, string> = {
      ACTIVE: $localize`:@@activeLabel:Activo`,
      INACTIVE: $localize`:@@inactiveLabel:Inactivo`,
      ARCHIVED: $localize`:@@archivedLabel:Archivado`
    };
    return labels[status];
  }

  moneyLabel(value: string, currency: string): string {
    const organization = this.organizationService.activeOrganization();
    return formatRegionalCurrency(value, {
      currency,
      numberFormat: organization?.numberFormat ?? "es"
    });
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

  toggleFilters(): void {
    this.filtersOpen.update((open) => !open);
  }

  hasActiveFilters(): boolean {
    const filters = this.filtersForm.getRawValue();
    return Boolean(
      filters.search || filters.sku || filters.code || filters.type || filters.status ||
      filters.minPrice !== null || filters.maxPrice !== null || filters.includeArchived
    );
  }

  async goToPage(page: number): Promise<void> {
    await this.load(page);
  }

  requestArchive(item: CatalogItem): void {
    this.pendingArchive.set(item);
  }

  async archive(): Promise<void> {
    const item = this.pendingArchive();
    if (!item || this.loading()) {
      return;
    }
    this.loading.set(true);
    this.error.set("");
    try {
      await this.catalogService.archive(this.organizationId, item.id);
      await this.load(this.catalog().page);
      this.pendingArchive.set(null);
      this.notifications.success(
        $localize`:@@catalogArchivedSuccess:Elemento archivado correctamente.`,
        this.undoLabel,
        () => void this.restoreItem(item)
      );
    } catch (error) {
      this.notifications.fromError(error);
      this.error.set($localize`:@@catalogArchiveError:No fue posible archivar el elemento.`);
    } finally {
      this.loading.set(false);
    }
  }

  private async restoreItem(item: CatalogItem): Promise<void> {
    try {
      await this.catalogService.update(this.organizationId, item.id, { type: item.type, status: item.status });
      await this.load(this.catalog().page);
      this.notifications.success($localize`:@@catalogRestoredSuccess:Elemento restaurado correctamente.`);
    } catch (error) {
      this.notifications.fromError(error);
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
      this.error.set($localize`:@@catalogLoadError:No fue posible cargar el catálogo.`);
    } finally {
      this.loading.set(false);
    }
  }
}
