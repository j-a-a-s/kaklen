import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { CatalogItem, CatalogItemStatus, CatalogItemType } from "../catalog/catalog.models";
import { CatalogService } from "../catalog/catalog.service";
import { formatRegionalCurrency } from "../i18n/formatting";
import { OrganizationService } from "../organizations/organization.service";
import { ActionMenuComponent, ActionMenuItemDirective } from "../shared/action-menu.component";
import { ConfirmationDialogComponent } from "../shared/confirmation-dialog.component";
import { NotificationService } from "../shared/notifications/notification.service";
import { UiIconComponent } from "../shared/ui-icon.component";

@Component({
  selector: "kaklen-catalog-detail",
  standalone: true,
  imports: [CommonModule, RouterLink, ActionMenuComponent, ActionMenuItemDirective, ConfirmationDialogComponent, UiIconComponent],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header" *ngIf="item() as currentItem">
        <div>
          <p class="eyebrow" i18n="@@catalogEyebrow">Catálogo</p>
          <h1>{{ currentItem.name }}</h1>
          <p>{{ currentItem.code }} · {{ typeLabel(currentItem.type) }} · {{ statusLabel(currentItem.status) }}</p>
        </div>
        <div class="row-actions">
          <a class="ghost button-link" [routerLink]="['/organizations', organizationId, 'catalog']"><kaklen-icon name="arrow-left" /><span i18n="@@backLink">Volver</span></a>
          <a
            *ngIf="canUpdate()"
            class="button-link"
            [routerLink]="['/organizations', organizationId, 'catalog', currentItem.id, 'edit']"
          >
            <kaklen-icon name="pencil" /><span i18n="@@editLink">Editar</span>
          </a>
          <kaklen-action-menu *ngIf="canDelete() && currentItem.status !== 'ARCHIVED'" [contextKey]="organizationId">
            <button kaklenMenuItem type="button" class="danger" (click)="archiveRequested.set(true)"><kaklen-icon name="archive" /><span i18n="@@archiveButton">Archivar</span></button>
          </kaklen-action-menu>
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
      <kaklen-confirmation-dialog
        [open]="archiveRequested()"
        [busy]="processing()"
        [title]="archiveDialogTitle"
        [description]="archiveDialogDescription"
        [confirmLabel]="archiveLabel"
        (confirm)="archive()"
        (cancel)="archiveRequested.set(false)"
      />
    </main>
  `
})
export class CatalogDetailComponent implements OnInit {
  readonly item = signal<CatalogItem | null>(null);
  readonly error = signal("");
  readonly processing = signal(false);
  readonly archiveRequested = signal(false);
  readonly emptySkuLabel = $localize`:@@emptySkuLabel:Sin SKU`;
  readonly emptyDescriptionLabel = $localize`:@@emptyDescriptionLabel:Sin descripción`;
  readonly trackedInventoryLabel = $localize`:@@trackedInventoryLabel:Controlado`;
  readonly untrackedInventoryLabel = $localize`:@@untrackedInventoryLabel:No controlado`;
  readonly archiveDialogTitle = $localize`:@@archiveCatalogDetailDialogTitle:Archivar elemento`;
  readonly archiveDialogDescription = $localize`:@@archiveCatalogDetailDialogDescription:El elemento dejará de estar disponible para nuevas operaciones, pero su información histórica se conservará.`;
  readonly archiveLabel = $localize`:@@archiveButton:Archivar`;
  organizationId = "";
  itemId = "";

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly catalogService: CatalogService,
    private readonly organizationService: OrganizationService,
    private readonly notifications: NotificationService
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

  canDelete(): boolean {
    return this.organizationService.hasPermission("catalog.delete");
  }

  async archive(): Promise<void> {
    if (this.processing()) return;
    this.processing.set(true);
    try {
      await this.catalogService.archive(this.organizationId, this.itemId);
      this.archiveRequested.set(false);
      this.notifications.success($localize`:@@catalogArchivedSuccess:Elemento archivado correctamente.`);
      await this.router.navigate(["/organizations", this.organizationId, "catalog"]);
    } catch (error) {
      this.notifications.fromError(error);
      this.error.set($localize`:@@catalogArchiveError:No fue posible archivar el elemento.`);
    } finally {
      this.processing.set(false);
    }
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
