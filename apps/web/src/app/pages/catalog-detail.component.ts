import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { CatalogItem, CatalogItemStatus, CatalogItemType } from "../catalog/catalog.models";
import { CatalogService } from "../catalog/catalog.service";
import { formatRegionalCurrency } from "../i18n/formatting";
import { OrganizationService } from "../organizations/organization.service";

@Component({
  selector: "kaklen-catalog-detail",
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header" *ngIf="item() as currentItem">
        <div>
          <p class="eyebrow" i18n="@@catalogEyebrow">Catálogo</p>
          <h1>{{ currentItem.name }}</h1>
          <p>{{ currentItem.code }} · {{ typeLabel(currentItem.type) }} · {{ statusLabel(currentItem.status) }}</p>
        </div>
        <div class="row-actions">
        <a [routerLink]="['/organizations', organizationId, 'catalog']" i18n="@@backLink">Volver</a>
          <a
            *ngIf="canUpdate()"
            class="button-link"
            [routerLink]="['/organizations', organizationId, 'catalog', currentItem.id, 'edit']"
          >
            <span i18n="@@editLink">Editar</span>
          </a>
        </div>
      </section>

      <p class="form-error" *ngIf="error()">{{ error() }}</p>

      <section class="dashboard-panel" *ngIf="item() as currentItem">
        <h2 i18n="@@dataTitle">Datos</h2>
        <dl class="detail-grid">
          <div>
            <dt i18n="@@skuLabel">SKU</dt>
            <dd>{{ currentItem.sku || emptySkuLabel }}</dd>
          </div>
          <div>
            <dt i18n="@@unitLabel">Unidad</dt>
            <dd>{{ currentItem.unit }}</dd>
          </div>
          <div>
            <dt i18n="@@costLabel">Costo</dt>
            <dd>{{ moneyLabel(currentItem.cost, currentItem.currency) }}</dd>
          </div>
          <div>
            <dt i18n="@@priceLabel">Precio</dt>
            <dd>{{ moneyLabel(currentItem.price, currentItem.currency) }}</dd>
          </div>
          <div>
            <dt i18n="@@taxLabel">Impuesto</dt>
            <dd>{{ currentItem.taxPercent }}%</dd>
          </div>
          <div>
            <dt i18n="@@inventoryLabel">Inventario</dt>
            <dd>{{ currentItem.trackInventory ? trackedInventoryLabel : untrackedInventoryLabel }}</dd>
          </div>
          <div>
            <dt i18n="@@descriptionLabel">Descripción</dt>
            <dd>{{ currentItem.description || emptyDescriptionLabel }}</dd>
          </div>
        </dl>
      </section>
    </main>
  `
})
export class CatalogDetailComponent implements OnInit {
  readonly item = signal<CatalogItem | null>(null);
  readonly error = signal("");
  readonly emptySkuLabel = $localize`:@@emptySkuLabel:Sin SKU`;
  readonly emptyDescriptionLabel = $localize`:@@emptyDescriptionLabel:Sin descripción`;
  readonly trackedInventoryLabel = $localize`:@@trackedInventoryLabel:Controlado`;
  readonly untrackedInventoryLabel = $localize`:@@untrackedInventoryLabel:No controlado`;
  organizationId = "";
  itemId = "";

  constructor(
    private readonly route: ActivatedRoute,
    private readonly catalogService: CatalogService,
    private readonly organizationService: OrganizationService
  ) {}

  async ngOnInit(): Promise<void> {
    this.organizationId = this.route.snapshot.paramMap.get("organizationId") ?? "";
    this.itemId = this.route.snapshot.paramMap.get("itemId") ?? "";
    await this.organizationService.setActiveOrganization(this.organizationId);
    await this.load();
  }

  canUpdate(): boolean {
    return this.organizationService.hasPermission("catalog.update");
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

  private async load(): Promise<void> {
    this.error.set("");
    try {
      this.item.set(await this.catalogService.get(this.organizationId, this.itemId));
    } catch {
      this.error.set($localize`:@@catalogItemLoadError:No fue posible cargar el item.`);
    }
  }
}
