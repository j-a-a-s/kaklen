import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { CatalogItemStatus, CatalogItemType } from "../catalog/catalog.models";
import { CatalogItemPayload, CatalogService } from "../catalog/catalog.service";
import { OrganizationService } from "../organizations/organization.service";
import { NotificationService } from "../shared/notifications/notification.service";
import { AssistantService } from "../assistant/assistant.service";
import { ProductAnalyticsService } from "../assistant/product-analytics.service";

@Component({
  selector: "kaklen-catalog-form",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header">
        <div>
          <p class="eyebrow" i18n="@@catalogEyebrow">Catálogo</p>
          <h1>{{ titleLabel() }}</h1>
        </div>
        <a [routerLink]="['/organizations', organizationId, 'catalog']" i18n="@@backLink">Volver</a>
      </section>

      <section class="dashboard-panel">
        <form [formGroup]="catalogForm" (ngSubmit)="save()">
          <div class="field-grid">
            <label>
              <span i18n="@@typeLabel">Tipo</span>
              <select formControlName="type">
                <option value="PRODUCT" i18n="@@productOption">Producto</option>
                <option value="SERVICE" i18n="@@serviceOption">Servicio</option>
              </select>
              <small>{{ inventoryLabel() }}</small>
            </label>
            <label>
              <span i18n="@@statusLabel">Estado</span>
              <select formControlName="status">
                <option value="ACTIVE" i18n="@@activeOption">Activo</option>
                <option value="INACTIVE" i18n="@@inactiveOption">Inactivo</option>
                <option value="ARCHIVED" i18n="@@archivedOption">Archivado</option>
              </select>
            </label>
            <label>
              <span i18n="@@codeLabel">Código</span>
              <input formControlName="code" maxlength="80" />
              <small *ngIf="showError('code')" i18n="@@codeRequired">El código es obligatorio.</small>
            </label>
            <label>
              <span i18n="@@skuLabel">SKU</span>
              <input formControlName="sku" maxlength="80" />
            </label>
            <label>
              <span i18n="@@nameLabel">Nombre</span>
              <input formControlName="name" maxlength="160" />
              <small *ngIf="showError('name')" i18n="@@nameRequired">El nombre es obligatorio.</small>
            </label>
            <label>
              <span i18n="@@unitLabel">Unidad</span>
              <input formControlName="unit" maxlength="40" placeholder="unidad, hora, kg" i18n-placeholder="@@unitPlaceholder" />
              <small *ngIf="showError('unit')" i18n="@@unitRequired">La unidad es obligatoria.</small>
            </label>
            <label>
              <span i18n="@@costLabel">Costo</span>
              <input type="number" min="0" step="0.01" formControlName="cost" />
              <small *ngIf="showError('cost')" i18n="@@costValidation">El costo debe ser mayor o igual a 0.</small>
            </label>
            <label>
              <span i18n="@@priceLabel">Precio</span>
              <input type="number" min="0" step="0.01" formControlName="price" />
              <small *ngIf="showError('price')" i18n="@@priceValidation">El precio debe ser mayor o igual a 0.</small>
            </label>
            <label>
              <span i18n="@@taxPercentLabel">Impuesto %</span>
              <input type="number" min="0" max="100" step="0.01" formControlName="taxPercent" />
              <small *ngIf="showError('taxPercent')" i18n="@@taxValidation">El impuesto debe estar entre 0 y 100.</small>
            </label>
            <label>
              <span i18n="@@currencyLabel">Moneda</span>
              <select formControlName="currency">
                <option value="CLP" i18n="@@currencyClpLabel">Peso chileno (CLP)</option>
                <option value="USD" i18n="@@currencyUsdLabel">Dólar estadounidense (USD)</option>
                <option value="BRL" i18n="@@currencyBrlLabel">Real brasileño (BRL)</option>
                <option value="EUR" i18n="@@currencyEurLabel">Euro (EUR)</option>
              </select>
              <small *ngIf="showError('currency')" i18n="@@currencyRequired">La moneda es obligatoria.</small>
            </label>
          </div>

          <label>
            <span i18n="@@descriptionLabel">Descripción</span>
            <textarea formControlName="description" maxlength="2000"></textarea>
          </label>

          <p class="form-error" *ngIf="error()">{{ error() }}</p>

          <div class="row-actions">
            <button type="submit" [disabled]="loading() || catalogForm.invalid">
              {{ loading() ? savingLabel : saveLabel }}
            </button>
            <a class="secondary-link" [routerLink]="['/organizations', organizationId, 'catalog']" i18n="@@cancelLink">Cancelar</a>
          </div>
        </form>
      </section>
    </main>
  `
})
export class CatalogFormComponent implements OnInit {
  readonly loading = signal(false);
  readonly error = signal("");
  readonly saveLabel = $localize`:@@saveButton:Guardar`;
  readonly savingLabel = $localize`:@@savingButton:Guardando...`;
  readonly catalogForm = new FormGroup({
    type: new FormControl<CatalogItemType>("PRODUCT", { nonNullable: true }),
    status: new FormControl<CatalogItemStatus>("ACTIVE", { nonNullable: true }),
    sku: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(80)] }),
    code: new FormControl("", { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
    name: new FormControl("", { nonNullable: true, validators: [Validators.required, Validators.maxLength(160)] }),
    description: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    unit: new FormControl("unidad", { nonNullable: true, validators: [Validators.required, Validators.maxLength(40)] }),
    cost: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    price: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    taxPercent: new FormControl(19, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(100)]
    }),
    currency: new FormControl("CLP", { nonNullable: true, validators: [Validators.required, Validators.maxLength(3)] })
  });
  organizationId = "";
  itemId = "";
  private initialCatalogItemCreated = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly catalogService: CatalogService,
    private readonly organizationService: OrganizationService,
    private readonly notifications: NotificationService,
    private readonly assistantService: AssistantService,
    private readonly analytics: ProductAnalyticsService
  ) {}

  async ngOnInit(): Promise<void> {
    this.organizationId = this.route.snapshot.paramMap.get("organizationId") ?? "";
    this.itemId = this.route.snapshot.paramMap.get("itemId") ?? "";
    await this.organizationService.setActiveOrganization(this.organizationId);
    if (this.itemId) {
      await this.loadItem();
    } else {
      this.initialCatalogItemCreated = (await this.assistantService.activation(this.organizationId)).completedSteps.includes("first_catalog_item_created");
    }
  }

  inventoryLabel(): string {
    return this.catalogForm.controls.type.value === "PRODUCT"
      ? $localize`:@@productInventoryHint:Los productos controlan inventario.`
      : $localize`:@@serviceInventoryHint:Los servicios no controlan inventario.`;
  }

  showError(controlName: keyof typeof this.catalogForm.controls): boolean {
    const control = this.catalogForm.controls[controlName];
    return control.invalid && (control.dirty || control.touched);
  }

  async save(): Promise<void> {
    this.catalogForm.markAllAsTouched();
    if (this.catalogForm.invalid) {
      return;
    }
    this.loading.set(true);
    this.error.set("");
    try {
      const payload = this.buildPayload();
      const item = this.itemId
        ? await this.catalogService.update(this.organizationId, this.itemId, payload)
        : await this.catalogService.create(this.organizationId, payload);
      this.notifications.success(this.successMessage(item.type));
      if (!this.itemId && !this.initialCatalogItemCreated) {
        this.analytics.track("first_catalog_item_created", { flow: "onboarding" });
      }
      await this.router.navigate(["/organizations", this.organizationId, "catalog", item.id]);
    } catch (error) {
      this.notifications.fromError(error);
      this.error.set($localize`:@@catalogItemSaveError:No fue posible guardar el item. Revisa el código y los datos ingresados.`);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadItem(): Promise<void> {
    this.loading.set(true);
    this.error.set("");
    try {
      const item = await this.catalogService.get(this.organizationId, this.itemId);
      this.catalogForm.setValue({
        type: item.type,
        status: item.status,
        sku: item.sku ?? "",
        code: item.code,
        name: item.name,
        description: item.description ?? "",
        unit: item.unit,
        cost: Number(item.cost),
        price: Number(item.price),
        taxPercent: Number(item.taxPercent),
        currency: item.currency
      });
    } catch {
      this.error.set($localize`:@@catalogItemLoadError:No fue posible cargar el item.`);
    } finally {
      this.loading.set(false);
    }
  }

  private buildPayload(): CatalogItemPayload {
    const value = this.catalogForm.getRawValue();
    return {
      type: value.type,
      status: value.status,
      sku: this.optional(value.sku),
      code: value.code.trim(),
      name: value.name.trim(),
      description: this.optional(value.description),
      unit: value.unit.trim(),
      cost: value.cost,
      price: value.price,
      taxPercent: value.taxPercent,
      currency: value.currency.trim().toUpperCase()
    };
  }

  titleLabel(): string {
    return this.itemId ? $localize`:@@editCatalogItemTitle:Editar item` : $localize`:@@newCatalogItemTitle:Nuevo item`;
  }

  private successMessage(type: CatalogItemType): string {
    if (this.itemId) {
      return $localize`:@@catalogUpdatedSuccess:Elemento actualizado correctamente.`;
    }
    return type === "PRODUCT"
      ? $localize`:@@catalogProductCreatedSuccess:Producto creado correctamente.`
      : $localize`:@@catalogServiceCreatedSuccess:Servicio creado correctamente.`;
  }

  private optional(value: string): string | undefined {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
}
