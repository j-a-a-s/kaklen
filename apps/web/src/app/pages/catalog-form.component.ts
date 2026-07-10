import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { CatalogItemStatus, CatalogItemType } from "../catalog/catalog.models";
import { CatalogItemPayload, CatalogService } from "../catalog/catalog.service";
import { OrganizationService } from "../organizations/organization.service";

@Component({
  selector: "kaklen-catalog-form",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header">
        <div>
          <p class="eyebrow">Catálogo</p>
          <h1>{{ itemId ? "Editar item" : "Nuevo item" }}</h1>
        </div>
        <a [routerLink]="['/organizations', organizationId, 'catalog']">Volver</a>
      </section>

      <section class="dashboard-panel">
        <form [formGroup]="catalogForm" (ngSubmit)="save()">
          <div class="field-grid">
            <label>
              Tipo
              <select formControlName="type">
                <option value="PRODUCT">Producto</option>
                <option value="SERVICE">Servicio</option>
              </select>
              <small>{{ inventoryLabel() }}</small>
            </label>
            <label>
              Estado
              <select formControlName="status">
                <option value="ACTIVE">Activo</option>
                <option value="INACTIVE">Inactivo</option>
                <option value="ARCHIVED">Archivado</option>
              </select>
            </label>
            <label>
              Código
              <input formControlName="code" maxlength="80" />
              <small *ngIf="showError('code')">El código es obligatorio.</small>
            </label>
            <label>
              SKU
              <input formControlName="sku" maxlength="80" />
            </label>
            <label>
              Nombre
              <input formControlName="name" maxlength="160" />
              <small *ngIf="showError('name')">El nombre es obligatorio.</small>
            </label>
            <label>
              Unidad
              <input formControlName="unit" maxlength="40" placeholder="unidad, hora, kg" />
              <small *ngIf="showError('unit')">La unidad es obligatoria.</small>
            </label>
            <label>
              Costo
              <input type="number" min="0" step="0.01" formControlName="cost" />
              <small *ngIf="showError('cost')">El costo debe ser mayor o igual a 0.</small>
            </label>
            <label>
              Precio
              <input type="number" min="0" step="0.01" formControlName="price" />
              <small *ngIf="showError('price')">El precio debe ser mayor o igual a 0.</small>
            </label>
            <label>
              Impuesto %
              <input type="number" min="0" max="100" step="0.01" formControlName="taxPercent" />
              <small *ngIf="showError('taxPercent')">El impuesto debe estar entre 0 y 100.</small>
            </label>
            <label>
              Moneda
              <input formControlName="currency" maxlength="3" />
              <small *ngIf="showError('currency')">La moneda es obligatoria.</small>
            </label>
          </div>

          <label>
            Descripción
            <textarea formControlName="description" maxlength="2000"></textarea>
          </label>

          <p class="form-error" *ngIf="error()">{{ error() }}</p>

          <div class="row-actions">
            <button type="submit" [disabled]="loading() || catalogForm.invalid">Guardar</button>
            <a class="secondary-link" [routerLink]="['/organizations', organizationId, 'catalog']">Cancelar</a>
          </div>
        </form>
      </section>
    </main>
  `
})
export class CatalogFormComponent implements OnInit {
  readonly loading = signal(false);
  readonly error = signal("");
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

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly catalogService: CatalogService,
    private readonly organizationService: OrganizationService
  ) {}

  async ngOnInit(): Promise<void> {
    this.organizationId = this.route.snapshot.paramMap.get("organizationId") ?? "";
    this.itemId = this.route.snapshot.paramMap.get("itemId") ?? "";
    await this.organizationService.setActiveOrganization(this.organizationId);
    if (this.itemId) {
      await this.loadItem();
    }
  }

  inventoryLabel(): string {
    return this.catalogForm.controls.type.value === "PRODUCT"
      ? "Los productos controlan inventario."
      : "Los servicios no controlan inventario.";
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
      await this.router.navigate(["/organizations", this.organizationId, "catalog", item.id]);
    } catch {
      this.error.set("No fue posible guardar el item. Revisa el código y los datos ingresados.");
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
      this.error.set("No fue posible cargar el item.");
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

  private optional(value: string): string | undefined {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
}
