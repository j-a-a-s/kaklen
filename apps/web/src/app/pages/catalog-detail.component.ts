import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { CatalogItem, CatalogItemStatus, CatalogItemType } from "../catalog/catalog.models";
import { CatalogService } from "../catalog/catalog.service";
import { OrganizationService } from "../organizations/organization.service";

@Component({
  selector: "kaklen-catalog-detail",
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header" *ngIf="item() as currentItem">
        <div>
          <p class="eyebrow">Catálogo</p>
          <h1>{{ currentItem.name }}</h1>
          <p>{{ currentItem.code }} · {{ typeLabel(currentItem.type) }} · {{ statusLabel(currentItem.status) }}</p>
        </div>
        <div class="row-actions">
          <a [routerLink]="['/organizations', organizationId, 'catalog']">Volver</a>
          <a
            *ngIf="canUpdate()"
            class="button-link"
            [routerLink]="['/organizations', organizationId, 'catalog', currentItem.id, 'edit']"
          >
            Editar
          </a>
        </div>
      </section>

      <p class="form-error" *ngIf="error()">{{ error() }}</p>

      <section class="dashboard-panel" *ngIf="item() as currentItem">
        <h2>Datos</h2>
        <dl class="detail-grid">
          <div>
            <dt>SKU</dt>
            <dd>{{ currentItem.sku || "Sin SKU" }}</dd>
          </div>
          <div>
            <dt>Unidad</dt>
            <dd>{{ currentItem.unit }}</dd>
          </div>
          <div>
            <dt>Costo</dt>
            <dd>{{ moneyLabel(currentItem.cost, currentItem.currency) }}</dd>
          </div>
          <div>
            <dt>Precio</dt>
            <dd>{{ moneyLabel(currentItem.price, currentItem.currency) }}</dd>
          </div>
          <div>
            <dt>Impuesto</dt>
            <dd>{{ currentItem.taxPercent }}%</dd>
          </div>
          <div>
            <dt>Inventario</dt>
            <dd>{{ currentItem.trackInventory ? "Controlado" : "No controlado" }}</dd>
          </div>
          <div>
            <dt>Descripción</dt>
            <dd>{{ currentItem.description || "Sin descripción" }}</dd>
          </div>
        </dl>
      </section>
    </main>
  `
})
export class CatalogDetailComponent implements OnInit {
  readonly item = signal<CatalogItem | null>(null);
  readonly error = signal("");
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

  private async load(): Promise<void> {
    this.error.set("");
    try {
      this.item.set(await this.catalogService.get(this.organizationId, this.itemId));
    } catch {
      this.error.set("No fue posible cargar el item.");
    }
  }
}
