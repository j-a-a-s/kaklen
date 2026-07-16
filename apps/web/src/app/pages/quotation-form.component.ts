import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit, computed, signal } from "@angular/core";
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
import { AssistantService } from "../assistant/assistant.service";
import { ProductAnalyticsService } from "../assistant/product-analytics.service";

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
          <p i18n="@@quotationFormDescription">Kaklen calculará y verificará automáticamente los totales al guardar.</p>
        </div>
        <a [routerLink]="['/organizations', organizationId, 'quotations']" i18n="@@backLink">Volver</a>
      </section>

      <ol class="wizard-steps" aria-label="Progreso de la cotización" i18n-aria-label="@@quotationProgressLabel">
        <li [class.active]="currentStep() === 1" [class.complete]="currentStep() > 1" [attr.aria-current]="currentStep() === 1 ? 'step' : null"><span>1</span><strong i18n="@@quotationStepClient">Elegir cliente</strong></li>
        <li [class.active]="currentStep() === 2" [class.complete]="currentStep() > 2" [attr.aria-current]="currentStep() === 2 ? 'step' : null"><span>2</span><strong i18n="@@quotationStepItems">Agregar productos y servicios</strong></li>
        <li [class.active]="currentStep() === 3" [class.complete]="currentStep() > 3" [attr.aria-current]="currentStep() === 3 ? 'step' : null"><span>3</span><strong i18n="@@quotationStepAdjustments">Ajustar descuentos e impuestos</strong></li>
        <li [class.active]="currentStep() === 4" [attr.aria-current]="currentStep() === 4 ? 'step' : null"><span>4</span><strong i18n="@@quotationStepReview">Revisar y guardar</strong></li>
      </ol>

      <form class="quotation-wizard-layout" [formGroup]="form" (ngSubmit)="save()">
        <section class="dashboard-panel wizard-panel">
          <div *ngIf="currentStep() === 1" class="wizard-stage">
            <h2 i18n="@@quotationStepClient">Elegir cliente</h2>
            <p i18n="@@quotationClientStepHelp">Selecciona quién recibirá la propuesta y define su vigencia.</p>
            <div class="wizard-support-row">
              <label class="search-control"><span i18n="@@searchClientLabel">Buscar cliente</span><input type="search" [value]="clientSearch()" (input)="clientSearch.set(inputValue($event))" placeholder="Nombre, email o RUT" i18n-placeholder="@@searchClientPlaceholder" /></label>
              <a class="secondary-link" [routerLink]="['/organizations', organizationId, 'clients', 'new']" target="_blank" rel="noopener" i18n="@@createClientNewTabAction">Crear cliente en otra pestaña</a>
              <button type="button" class="secondary" (click)="loadClients()" i18n="@@refreshClientsAction">Actualizar clientes</button>
            </div>
            <div class="field-grid">
              <label>
                <span i18n="@@clientLabel">Cliente</span>
                <select formControlName="clientId">
                  <option value="" i18n="@@selectClientOption">Selecciona cliente</option>
                  <option *ngFor="let client of filteredClients()" [value]="client.id">{{ client.displayName }}</option>
                </select>
              </label>
            </div>
            <article class="selected-client-summary" *ngIf="selectedClient() as client"><strong>{{ client.displayName }}</strong><small>{{ client.email || client.taxId || client.phone || clientSummaryFallback }}</small></article>
          </div>

          <div *ngIf="currentStep() === 2" class="wizard-stage" formArrayName="items">
            <div class="section-heading"><div><h2 i18n="@@quotationStepItems">Agregar productos y servicios</h2><small i18n="@@quotationItemsStepHelp">Usa el catálogo o agrega un concepto personalizado.</small></div><button type="button" class="secondary" (click)="addItem()" i18n="@@addItemButton">Agregar ítem</button></div>
            <label class="search-control"><span i18n="@@searchCatalogLabel">Buscar en catálogo</span><input type="search" [value]="catalogSearch()" (input)="catalogSearch.set(inputValue($event))" placeholder="Nombre, código o SKU" i18n-placeholder="@@searchCatalogPlaceholder" /></label>
            <article class="quotation-item-editor" *ngFor="let item of items.controls; let index = index" [formGroupName]="index">
              <div class="section-heading compact"><strong i18n="@@quotationItemNumber">Ítem {{ index + 1 }}</strong><strong>{{ previewItemTotal(index) }}</strong></div>
              <div class="field-grid">
                <label><span i18n="@@catalogItemLabel">Producto o servicio</span><select formControlName="catalogItemId" (change)="applyCatalogItem(index)"><option value="" i18n="@@customItemOption">Ítem personalizado</option><option *ngFor="let catalogItem of filteredCatalogItems()" [value]="catalogItem.id">{{ catalogItem.code }} · {{ catalogItem.name }}</option></select></label>
                <label><span i18n="@@typeLabel">Tipo</span><select formControlName="type"><option value="PRODUCT" i18n="@@productOption">Producto</option><option value="SERVICE" i18n="@@serviceOption">Servicio</option><option value="CUSTOM" i18n="@@customOption">Personalizado</option></select></label>
                <label><span i18n="@@codeLabel">Código</span><input formControlName="code" /></label>
                <label><span i18n="@@nameLabel">Nombre</span><input formControlName="name" /></label>
                <label><span i18n="@@quantityLabel">Cantidad</span><input type="number" min="0.001" step="0.001" formControlName="quantity" /></label>
                <label><span i18n="@@unitLabel">Unidad</span><input formControlName="unit" /></label>
                <label><span i18n="@@unitPriceLabel">Precio unitario</span><input type="number" min="0" step="0.01" formControlName="unitPrice" /></label>
              </div>
              <div class="row-actions"><button type="button" class="secondary" (click)="duplicateItem(index)" i18n="@@duplicateLineButton">Duplicar línea</button><button type="button" class="secondary" (click)="removeItem(index)" [disabled]="items.length === 1" i18n="@@removeButton">Quitar</button></div>
            </article>
          </div>

          <div *ngIf="currentStep() === 3" class="wizard-stage" formArrayName="items">
            <h2 i18n="@@quotationStepAdjustments">Ajustar descuentos e impuestos</h2>
            <p i18n="@@quotationAdjustmentsStepHelp">Revisa cada concepto y aplica solo los ajustes necesarios.</p>
            <div class="field-grid">
              <label><span i18n="@@issueDateLabel">Fecha de emisión</span><input type="date" formControlName="issueDate" /></label>
              <label><span i18n="@@validUntilLabel">Válida hasta</span><input type="date" formControlName="validUntil" /></label>
              <label><span i18n="@@currencyLabel">Moneda</span><select formControlName="currency"><option value="CLP" i18n="@@currencyClpLabel">Peso chileno (CLP)</option><option value="USD" i18n="@@currencyUsdLabel">Dólar estadounidense (USD)</option><option value="BRL" i18n="@@currencyBrlLabel">Real brasileño (BRL)</option><option value="EUR" i18n="@@currencyEurLabel">Euro (EUR)</option></select></label>
              <label><span i18n="@@globalDiscountLabel">Descuento global (%)</span><input type="number" min="0" max="100" step="0.01" formControlName="globalDiscountPercent" /><small i18n="@@globalDiscountHelp">Se aplica a las líneas que no tienen un descuento específico.</small></label>
            </div>
            <article class="quotation-item-editor" *ngFor="let item of items.controls; let index = index" [formGroupName]="index">
              <div class="section-heading compact"><strong>{{ item.controls.name.value }}</strong><strong>{{ previewItemTotal(index) }}</strong></div>
              <div class="field-grid">
                <label><span i18n="@@discountTypeLabel">Tipo de descuento</span><select formControlName="discountType"><option value="NONE" i18n="@@discountNoneOption">Sin descuento</option><option value="PERCENTAGE" i18n="@@discountPercentageOption">Porcentaje</option><option value="FIXED" i18n="@@discountFixedOption">Monto fijo</option></select></label>
                <label><span i18n="@@discountValueLabel">Descuento</span><input type="number" min="0" step="0.01" formControlName="discountValue" /></label>
                <label><span i18n="@@taxLabel">Impuesto (%)</span><input type="number" min="0" max="100" step="0.01" formControlName="taxPercent" /></label>
              </div>
            </article>
            <label><span i18n="@@termsLabel">Términos</span><textarea formControlName="terms" placeholder="Forma de pago, plazos y condiciones" i18n-placeholder="@@termsExample"></textarea></label>
            <label><span i18n="@@notesLabel">Notas</span><textarea formControlName="notes" placeholder="Información útil para el cliente" i18n-placeholder="@@quotationNotesExample"></textarea></label>
          </div>

          <div *ngIf="currentStep() === 4" class="wizard-stage">
            <h2 i18n="@@quotationStepReview">Revisar y guardar</h2>
            <p i18n="@@quotationReviewStepHelp">Confirma el cliente, los conceptos y el total antes de guardar.</p>
            <dl class="detail-grid quotation-review-overview"><div><dt i18n="@@clientLabel">Cliente</dt><dd>{{ selectedClient()?.displayName }}</dd></div><div><dt i18n="@@issueDateLabel">Fecha de emisión</dt><dd>{{ form.controls.issueDate.value }}</dd></div><div><dt i18n="@@validUntilLabel">Válida hasta</dt><dd>{{ form.controls.validUntil.value }}</dd></div><div><dt i18n="@@currencyLabel">Moneda</dt><dd>{{ form.controls.currency.value }}</dd></div><div><dt i18n="@@globalDiscountLabel">Descuento global (%)</dt><dd>{{ form.controls.globalDiscountPercent.value }}%</dd></div></dl>
            <div class="quotation-review-list"><article *ngFor="let item of items.controls; let index = index"><span><strong>{{ item.controls.name.value }}</strong><small>{{ item.controls.quantity.value }} {{ item.controls.unit.value }}</small></span><strong>{{ previewItemTotal(index) }}</strong></article></div>
            <p class="verification-note" i18n="@@quotationVerificationNote">Kaklen calculará y verificará automáticamente los totales al guardar.</p>
          </div>

          <p class="form-error" *ngIf="stepError()">{{ stepError() }}</p>
          <p class="form-error" *ngIf="error()">{{ error() }}</p>
          <div class="wizard-actions">
            <button type="button" class="secondary" *ngIf="currentStep() > 1" (click)="previousStep()" i18n="@@backButton">Volver</button>
            <button type="button" *ngIf="currentStep() < 4" (click)="nextStep()" i18n="@@continueButton">Continuar</button>
            <button type="submit" *ngIf="currentStep() === 4" [disabled]="loading()">{{ loading() ? savingLabel : saveQuotationLabel }}</button>
          </div>
        </section>

        <aside class="quotation-summary desktop-quotation-summary" aria-label="Resumen de cotización" i18n-aria-label="@@quotationSummaryLabel">
          <h2 i18n="@@summaryTitle">Resumen</h2>
          <dl><div><dt i18n="@@subtotalLabel">Subtotal</dt><dd>{{ moneyLabel(subtotal()) }}</dd></div><div><dt i18n="@@discountTotalLabel">Descuento</dt><dd>-{{ moneyLabel(discountTotal()) }}</dd></div><div><dt i18n="@@taxTotalLabel">IVA</dt><dd>{{ moneyLabel(taxTotal()) }}</dd></div><div class="quotation-total"><dt i18n="@@totalLabel">Total</dt><dd>{{ moneyLabel(grandTotal()) }}</dd></div></dl>
        </aside>
        <details class="mobile-quotation-summary"><summary><span i18n="@@quotationSummaryLabel">Resumen de cotización</span><strong>{{ moneyLabel(grandTotal()) }}</strong></summary><dl><div><dt i18n="@@subtotalLabel">Subtotal</dt><dd>{{ moneyLabel(subtotal()) }}</dd></div><div><dt i18n="@@discountTotalLabel">Descuento</dt><dd>-{{ moneyLabel(discountTotal()) }}</dd></div><div><dt i18n="@@taxTotalLabel">IVA</dt><dd>{{ moneyLabel(taxTotal()) }}</dd></div></dl></details>
      </form>
    </main>
  `
})
export class QuotationFormComponent implements OnInit, OnDestroy {
  readonly loading = signal(false);
  readonly error = signal("");
  readonly stepError = signal("");
  readonly currentStep = signal(1);
  readonly clients = signal<Client[]>([]);
  readonly catalogItems = signal<CatalogItem[]>([]);
  readonly clientSearch = signal("");
  readonly catalogSearch = signal("");
  readonly newTitle = $localize`:@@newQuotationTitle:Nueva cotización`;
  readonly editTitle = $localize`:@@editQuotationTitle:Editar cotización`;
  readonly saveQuotationLabel = $localize`:@@saveQuotationButton:Guardar cotización`;
  readonly savingLabel = $localize`:@@savingButton:Guardando...`;
  readonly clientSummaryFallback = $localize`:@@clientSummaryFallback:Cliente registrado sin datos de contacto`;
  readonly form = new FormGroup({
    clientId: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    issueDate: new FormControl(new Date().toISOString().slice(0, 10), { nonNullable: true, validators: [Validators.required] }),
    validUntil: new FormControl(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), { nonNullable: true, validators: [Validators.required] }),
    currency: new FormControl("CLP", { nonNullable: true, validators: [Validators.required] }),
    globalDiscountPercent: new FormControl(0, { nonNullable: true, validators: [Validators.min(0), Validators.max(100)] }),
    notes: new FormControl("", { nonNullable: true }),
    terms: new FormControl("", { nonNullable: true }),
    items: new FormArray<ItemForm>([])
  });
  readonly isEdit = computed(() => Boolean(this.quotationId));
  organizationId = "";
  quotationId = "";
  private initialQuotationCreated = false;
  private wizardCompleted = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly clientsService: ClientsService,
    private readonly catalogService: CatalogService,
    private readonly organizationService: OrganizationService,
    private readonly quotationsService: QuotationsService,
    private readonly notifications: NotificationService,
    private readonly assistantService: AssistantService,
    private readonly analytics: ProductAnalyticsService
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
    const requestedClientId = this.route.snapshot.queryParamMap.get("clientId");
    if (requestedClientId) {
      this.form.controls.clientId.setValue(requestedClientId);
    }
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
      this.initialQuotationCreated = (await this.assistantService.activation(this.organizationId)).completedSteps.includes("first_quotation_created");
    }
  }

  ngOnDestroy(): void {
    if (!this.quotationId && this.form.dirty && !this.wizardCompleted) {
      this.analytics.track("wizard_abandoned", { flow: "quotation", step: String(this.currentStep()) });
    }
  }

  async save(): Promise<void> {
    if (!this.validateStep(4) || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set("");
    try {
      const value = this.form.getRawValue();
      const { globalDiscountPercent: _globalDiscountPercent, ...quotationValue } = value;
      const payload = { ...quotationValue, items: value.items.map((item) => this.effectiveItem(item)) };
      const quotation = this.quotationId
        ? await this.quotationsService.update(this.organizationId, this.quotationId, payload)
        : await this.quotationsService.create(this.organizationId, payload);
      this.notifications.success(
        this.quotationId
          ? $localize`:@@quotationUpdatedSuccess:Cotización actualizada correctamente.`
          : $localize`:@@quotationCreatedSuccess:Cotización creada correctamente.`
      );
      if (!this.quotationId) {
        this.wizardCompleted = true;
        this.analytics.track("wizard_completed", { flow: "quotation", step: "review" });
        if (!this.initialQuotationCreated) this.analytics.track("first_quotation_created", { flow: "quotation" });
      }
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

  duplicateItem(index: number): void {
    this.items.insert(index + 1, this.createItem(this.mapItem(this.items.at(index).getRawValue())));
  }

  nextStep(): void {
    const step = this.currentStep();
    if (!this.validateStep(step)) {
      this.stepError.set($localize`:@@quotationStepValidationError:Completa los campos obligatorios de esta etapa para continuar.`);
      return;
    }
    this.stepError.set("");
    this.currentStep.set(Math.min(4, step + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  previousStep(): void {
    this.stepError.set("");
    this.currentStep.update((step) => Math.max(1, step - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    return this.moneyLabel(this.itemAmounts(index).total);
  }

  previewTotal(): string {
    return this.moneyLabel(this.grandTotal());
  }

  filteredClients(): Client[] {
    const query = this.normalize(this.clientSearch());
    if (!query) return this.clients();
    return this.clients().filter((client) => this.normalize([client.displayName, client.email, client.taxId].filter(Boolean).join(" ")).includes(query));
  }

  filteredCatalogItems(): CatalogItem[] {
    const query = this.normalize(this.catalogSearch());
    if (!query) return this.catalogItems();
    return this.catalogItems().filter((item) => this.normalize([item.name, item.code, item.sku].filter(Boolean).join(" ")).includes(query));
  }

  selectedClient(): Client | undefined {
    return this.clients().find((client) => client.id === this.form.controls.clientId.value);
  }

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  subtotal(): number {
    return this.items.controls.reduce((sum, _item, index) => sum + this.itemAmounts(index).subtotal, 0);
  }

  discountTotal(): number {
    return this.items.controls.reduce((sum, _item, index) => sum + this.itemAmounts(index).discount, 0);
  }

  taxTotal(): number {
    return this.items.controls.reduce((sum, _item, index) => sum + this.itemAmounts(index).tax, 0);
  }

  grandTotal(): number {
    return this.items.controls.reduce((sum, _item, index) => sum + this.itemAmounts(index).total, 0);
  }

  async loadClients(): Promise<void> {
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

  moneyLabel(value: string | number): string {
    const organization = this.organizationService.activeOrganization();
    return formatRegionalCurrency(value, {
      currency: this.form.controls.currency.value || organization?.currency || "CLP",
      numberFormat: organization?.numberFormat ?? "es"
    });
  }

  private validateStep(step: number): boolean {
    if (step === 1) {
      const controls = [this.form.controls.clientId];
      controls.forEach((control) => control.markAsTouched());
      return controls.every((control) => control.valid);
    }

    if (step === 2) {
      const controls = this.items.controls.flatMap((item) => [
        item.controls.name,
        item.controls.quantity,
        item.controls.unit,
        item.controls.unitPrice
      ]);
      controls.forEach((control) => control.markAsTouched());
      return this.items.length > 0 && controls.every((control) => control.valid);
    }

    if (step === 3) {
      const controls = [this.form.controls.issueDate, this.form.controls.validUntil, this.form.controls.currency, this.form.controls.globalDiscountPercent, ...this.items.controls.flatMap((item) => [item.controls.discountValue, item.controls.taxPercent])];
      controls.forEach((control) => control.markAsTouched());
      return controls.every((control) => control.valid) && this.form.controls.validUntil.value >= this.form.controls.issueDate.value && this.items.controls.every((item) => {
        const value = item.getRawValue();
        return value.discountType !== "PERCENTAGE" || value.discountValue <= 100;
      });
    }

    this.form.markAllAsTouched();
    return this.form.valid;
  }

  private itemAmounts(index: number): { subtotal: number; discount: number; tax: number; total: number } {
    const item = this.effectiveItem(this.items.at(index).getRawValue());
    const unitPriceCents = Math.round(item.unitPrice * 100);
    const quantityThousandths = Math.round(item.quantity * 1000);
    const subtotalCents = Math.round(unitPriceCents * quantityThousandths / 1000);
    const requestedDiscountCents = item.discountType === "PERCENTAGE"
      ? Math.round(subtotalCents * (item.discountValue ?? 0) / 100)
      : item.discountType === "FIXED" ? Math.round((item.discountValue ?? 0) * 100) : 0;
    const discountCents = Math.min(subtotalCents, requestedDiscountCents);
    const taxableCents = Math.max(0, subtotalCents - discountCents);
    const taxCents = Math.round(taxableCents * item.taxPercent / 100);
    return { subtotal: subtotalCents / 100, discount: discountCents / 100, tax: taxCents / 100, total: (taxableCents + taxCents) / 100 };
  }

  private normalize(value: string): string {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }

  private effectiveItem(item: ReturnType<ItemForm["getRawValue"]>): QuotationItemPayload {
    const mapped = this.mapItem(item);
    const globalDiscountPercent = this.form.controls.globalDiscountPercent.value;
    return mapped.discountType === "NONE" && globalDiscountPercent > 0
      ? { ...mapped, discountType: "PERCENTAGE", discountValue: globalDiscountPercent }
      : mapped;
  }
}
