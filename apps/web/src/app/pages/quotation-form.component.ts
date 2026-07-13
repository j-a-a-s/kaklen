import { CommonModule } from "@angular/common";
import { Component, OnInit, computed, signal } from "@angular/core";
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { CatalogItem } from "../catalog/catalog.models";
import { CatalogService } from "../catalog/catalog.service";
import { Client } from "../clients/client.models";
import { ClientsService } from "../clients/clients.service";
import { formatRegionalCurrency } from "../i18n/formatting";
import { OrganizationService } from "../organizations/organization.service";
import { QuotationDiscountType, QuotationItemPayload, QuotationItemType } from "../quotations/quotation.models";
import { QuotationsService } from "../quotations/quotations.service";
import { NotificationService } from "../shared/notifications/notification.service";

type ItemForm = FormGroup<{
  catalogItemId: FormControl<string>;
  type: FormControl<QuotationItemType>;
  code: FormControl<string>;
  name: FormControl<string>;
  description: FormControl<string>;
  quantity: FormControl<number>;
  unit: FormControl<string>;
  unitPrice: FormControl<number>;
  discountType: FormControl<QuotationDiscountType>;
  discountValue: FormControl<number>;
  taxPercent: FormControl<number>;
}>;

@Component({
  selector: "kaklen-quotation-form",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header">
        <div>
          <p class="eyebrow" i18n="@@quotationsEyebrow">Cotizaciones</p>
          <h1>{{ isEdit() ? editTitle : newTitle }}</h1>
          <p i18n="@@quotationFormDescription">Los totales se recalculan en backend al guardar.</p>
        </div>
        <a [routerLink]="['/organizations', organizationId, 'quotations']" i18n="@@backLink">Volver</a>
      </section>

      <form class="dashboard-panel" [formGroup]="form" (ngSubmit)="save()">
        <div class="field-grid">
          <label>
            <span i18n="@@clientLabel">Cliente</span>
            <select formControlName="clientId">
              <option value="" i18n="@@selectClientOption">Selecciona cliente</option>
              <option *ngFor="let client of clients()" [value]="client.id">{{ client.displayName }}</option>
            </select>
          </label>
          <label>
            <span i18n="@@issueDateLabel">Fecha de emisión</span>
            <input type="date" formControlName="issueDate" />
          </label>
          <label>
            <span i18n="@@validUntilLabel">Válida hasta</span>
            <input type="date" formControlName="validUntil" />
          </label>
          <label>
            <span i18n="@@currencyLabel">Moneda</span>
            <input formControlName="currency" maxlength="3" />
          </label>
        </div>

        <section class="list-panel" formArrayName="items">
          <article class="item-row" *ngFor="let item of items.controls; let index = index" [formGroupName]="index">
            <div class="field-grid">
              <label>
                <span i18n="@@catalogItemLabel">Producto o servicio</span>
                <select formControlName="catalogItemId" (change)="applyCatalogItem(index)">
                  <option value="" i18n="@@customItemOption">Ítem personalizado</option>
                  <option *ngFor="let catalogItem of catalogItems()" [value]="catalogItem.id">{{ catalogItem.code }} · {{ catalogItem.name }}</option>
                </select>
              </label>
              <label>
                <span i18n="@@typeLabel">Tipo</span>
                <select formControlName="type">
                  <option value="PRODUCT" i18n="@@productOption">Producto</option>
                  <option value="SERVICE" i18n="@@serviceOption">Servicio</option>
                  <option value="CUSTOM" i18n="@@customOption">Personalizado</option>
                </select>
              </label>
              <label>
                <span i18n="@@codeLabel">Código</span>
                <input formControlName="code" />
              </label>
              <label>
                <span i18n="@@nameLabel">Nombre</span>
                <input formControlName="name" />
              </label>
              <label>
                <span i18n="@@quantityLabel">Cantidad</span>
                <input type="number" min="0.001" step="0.001" formControlName="quantity" />
              </label>
              <label>
                <span i18n="@@unitLabel">Unidad</span>
                <input formControlName="unit" />
              </label>
              <label>
                <span i18n="@@unitPriceLabel">Precio unitario</span>
                <input type="number" min="0" step="0.01" formControlName="unitPrice" />
              </label>
              <label>
                <span i18n="@@discountTypeLabel">Tipo de descuento</span>
                <select formControlName="discountType">
                  <option value="NONE" i18n="@@discountNoneOption">Sin descuento</option>
                  <option value="PERCENTAGE" i18n="@@discountPercentageOption">Porcentaje</option>
                  <option value="FIXED" i18n="@@discountFixedOption">Monto fijo</option>
                </select>
              </label>
              <label>
                <span i18n="@@discountValueLabel">Descuento</span>
                <input type="number" min="0" step="0.01" formControlName="discountValue" />
              </label>
              <label>
                <span i18n="@@taxLabel">Impuesto</span>
                <input type="number" min="0" max="100" step="0.01" formControlName="taxPercent" />
              </label>
            </div>
            <p>{{ previewItemTotal(index) }}</p>
            <button type="button" class="secondary" (click)="removeItem(index)" [disabled]="items.length === 1" i18n="@@removeButton">Quitar</button>
          </article>
        </section>

        <div class="row-actions">
          <button type="button" class="secondary" (click)="addItem()" i18n="@@addItemButton">Agregar ítem</button>
          <strong>{{ previewTotal() }}</strong>
        </div>
        <label>
          <span i18n="@@notesLabel">Notas</span>
          <textarea formControlName="notes"></textarea>
        </label>
        <label>
          <span i18n="@@termsLabel">Términos</span>
          <textarea formControlName="terms"></textarea>
        </label>
        <p class="form-error" *ngIf="error()">{{ error() }}</p>
        <button type="submit" [disabled]="form.invalid || loading()">
          {{ loading() ? savingLabel : saveQuotationLabel }}
        </button>
      </form>
    </main>
  `
})
export class QuotationFormComponent implements OnInit {
  readonly loading = signal(false);
  readonly error = signal("");
  readonly clients = signal<Client[]>([]);
  readonly catalogItems = signal<CatalogItem[]>([]);
  readonly newTitle = $localize`:@@newQuotationTitle:Nueva cotización`;
  readonly editTitle = $localize`:@@editQuotationTitle:Editar cotización`;
  readonly saveQuotationLabel = $localize`:@@saveQuotationButton:Guardar cotización`;
  readonly savingLabel = $localize`:@@savingButton:Guardando...`;
  readonly form = new FormGroup({
    clientId: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    issueDate: new FormControl(new Date().toISOString().slice(0, 10), { nonNullable: true, validators: [Validators.required] }),
    validUntil: new FormControl(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), { nonNullable: true, validators: [Validators.required] }),
    currency: new FormControl("CLP", { nonNullable: true, validators: [Validators.required] }),
    notes: new FormControl("", { nonNullable: true }),
    terms: new FormControl("", { nonNullable: true }),
    items: new FormArray<ItemForm>([])
  });
  readonly isEdit = computed(() => Boolean(this.quotationId));
  organizationId = "";
  quotationId = "";

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly clientsService: ClientsService,
    private readonly catalogService: CatalogService,
    private readonly organizationService: OrganizationService,
    private readonly quotationsService: QuotationsService,
    private readonly notifications: NotificationService
  ) {}

  get items(): FormArray<ItemForm> {
    return this.form.controls.items;
  }

  async ngOnInit(): Promise<void> {
    this.organizationId = this.route.snapshot.paramMap.get("organizationId") ?? "";
    this.quotationId = this.route.snapshot.paramMap.get("quotationId") ?? "";
    await this.organizationService.setActiveOrganization(this.organizationId);
    const organization = this.organizationService.activeOrganization();
    this.form.controls.currency.setValue(organization?.currency ?? "CLP");
    await Promise.all([this.loadClients(), this.loadCatalog()]);
    if (this.quotationId) {
      const quotation = await this.quotationsService.get(this.organizationId, this.quotationId);
      this.form.patchValue({
        clientId: quotation.clientId,
        issueDate: quotation.issueDate.slice(0, 10),
        validUntil: quotation.validUntil.slice(0, 10),
        currency: quotation.currency,
        notes: quotation.notes ?? "",
        terms: quotation.terms ?? ""
      });
      this.items.clear();
      quotation.items.forEach((item) =>
        this.items.push(
          this.createItem({
            catalogItemId: item.catalogItemId ?? "",
            type: item.type,
            code: item.code ?? "",
            name: item.name,
            description: item.description ?? "",
            quantity: Number(item.quantity),
            unit: item.unit,
            unitPrice: Number(item.unitPrice),
            discountType: item.discountType,
            discountValue: Number(item.discountValue),
            taxPercent: Number(item.taxPercent)
          })
        )
      );
    } else {
      this.addItem();
    }
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set("");
    try {
      const value = this.form.getRawValue();
      const payload = { ...value, items: value.items.map((item) => this.mapItem(item)) };
      const quotation = this.quotationId
        ? await this.quotationsService.update(this.organizationId, this.quotationId, payload)
        : await this.quotationsService.create(this.organizationId, payload);
      this.notifications.success(
        this.quotationId
          ? $localize`:@@quotationUpdatedSuccess:Cotización actualizada correctamente.`
          : $localize`:@@quotationCreatedSuccess:Cotización creada correctamente.`
      );
      await this.router.navigate(["/organizations", this.organizationId, "quotations", quotation.id]);
    } catch (error) {
      this.notifications.fromError(error);
      this.error.set($localize`:@@quotationSaveError:No fue posible guardar la cotización.`);
    } finally {
      this.loading.set(false);
    }
  }

  addItem(): void {
    this.items.push(this.createItem());
  }

  removeItem(index: number): void {
    this.items.removeAt(index);
  }

  applyCatalogItem(index: number): void {
    const control = this.items.at(index);
    const catalogItem = this.catalogItems().find((item) => item.id === control.controls.catalogItemId.value);
    if (!catalogItem) {
      control.patchValue({ type: "CUSTOM" });
      return;
    }
    control.patchValue({
      type: catalogItem.type,
      code: catalogItem.code,
      name: catalogItem.name,
      description: catalogItem.description ?? "",
      unit: catalogItem.unit,
      unitPrice: Number(catalogItem.price),
      taxPercent: Number(catalogItem.taxPercent)
    });
  }

  previewItemTotal(index: number): string {
    const item = this.mapItem(this.items.at(index).getRawValue());
    const subtotal = item.quantity * item.unitPrice;
    const discount = item.discountType === "PERCENTAGE" ? subtotal * (item.discountValue ?? 0) / 100 : item.discountType === "FIXED" ? item.discountValue ?? 0 : 0;
    const total = Math.max(0, subtotal - discount) * (1 + item.taxPercent / 100);
    return this.moneyLabel(total);
  }

  previewTotal(): string {
    return this.moneyLabel(this.items.controls.reduce((sum, item, index) => {
      const text = this.previewItemTotal(index).replace(/[^\d,.-]/g, "").replace(".", "").replace(",", ".");
      return sum + (Number(text) || 0);
    }, 0));
  }

  private async loadClients(): Promise<void> {
    this.clients.set((await this.clientsService.list(this.organizationId, { pageSize: 100 })).items);
  }

  private async loadCatalog(): Promise<void> {
    this.catalogItems.set((await this.catalogService.list(this.organizationId, { pageSize: 100 })).items);
  }

  private createItem(value?: Partial<QuotationItemPayload>): ItemForm {
    return new FormGroup({
      catalogItemId: new FormControl(value?.catalogItemId ?? "", { nonNullable: true }),
      type: new FormControl(value?.type ?? "CUSTOM", { nonNullable: true }),
      code: new FormControl(value?.code ?? "", { nonNullable: true }),
      name: new FormControl(value?.name ?? "", { nonNullable: true, validators: [Validators.required] }),
      description: new FormControl(value?.description ?? "", { nonNullable: true }),
      quantity: new FormControl(value?.quantity ?? 1, { nonNullable: true, validators: [Validators.required, Validators.min(0.001)] }),
      unit: new FormControl(value?.unit ?? "unidad", { nonNullable: true, validators: [Validators.required] }),
      unitPrice: new FormControl(value?.unitPrice ?? 0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
      discountType: new FormControl(value?.discountType ?? "NONE", { nonNullable: true }),
      discountValue: new FormControl(value?.discountValue ?? 0, { nonNullable: true, validators: [Validators.min(0)] }),
      taxPercent: new FormControl(value?.taxPercent ?? 0, { nonNullable: true, validators: [Validators.required, Validators.min(0), Validators.max(100)] })
    });
  }

  private mapItem(item: ReturnType<ItemForm["getRawValue"]>): QuotationItemPayload {
    return {
      catalogItemId: item.catalogItemId || undefined,
      type: item.type,
      code: item.code || undefined,
      name: item.name,
      description: item.description || undefined,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      discountType: item.discountType,
      discountValue: item.discountValue,
      taxPercent: item.taxPercent
    };
  }

  private moneyLabel(value: string | number): string {
    const organization = this.organizationService.activeOrganization();
    return formatRegionalCurrency(value, {
      currency: this.form.controls.currency.value || organization?.currency || "CLP",
      numberFormat: organization?.numberFormat ?? "es"
    });
  }
}
