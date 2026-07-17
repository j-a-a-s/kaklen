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
import { calculateQuotationMoney, QuotationMoneyResult } from "@kaklen/shared";
import { dateOrderValidator, decimalValidator, trimmedRequired } from "../shared/forms/form-validators";
import { FieldErrorComponent, FormControlA11yDirective, FormErrorSummaryComponent, WizardStepIndicatorComponent,
  FormFieldComponent
} from "../shared/forms/form-feedback.components";
import { WizardValidationState } from "../shared/forms/wizard-validation-state";
import { UiIconComponent } from "../shared/ui-icon.component";

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
  imports: [FormFieldComponent, CommonModule, ReactiveFormsModule, RouterLink, FieldErrorComponent, FormControlA11yDirective, FormErrorSummaryComponent, WizardStepIndicatorComponent, UiIconComponent],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header">
        <div>
          <p class="eyebrow" i18n="@@quotationsEyebrow">Cotizaciones</p>
          <h1>{{ isEdit() ? editTitle : newTitle }}</h1>
          <p i18n="@@quotationFormDescription">Kaklen calculará y verificará automáticamente los totales al guardar.</p>
        </div>
        <a class="ghost button-link" [routerLink]="['/organizations', organizationId, 'quotations']"><kaklen-icon name="arrow-left" /><span i18n="@@backLink">Volver</span></a>
      </section>

      <kaklen-wizard-steps [steps]="wizardSteps" [currentStep]="currentStep()" [ariaLabel]="quotationProgressLabel" />

      <form class="quotation-wizard-layout" [formGroup]="form" (ngSubmit)="save()">
        <section class="dashboard-panel wizard-panel">
          <kaklen-form-error-summary [form]="form" [attempted]="wizardAttempted()" [scopePaths]="activeStepPaths()" [labels]="fieldLabels" [fieldIds]="fieldIds" [groupErrorFields]="groupErrorFields" [messages]="fieldMessages" />
          <div *ngIf="currentStep() === 1" class="wizard-stage">
            <h2 i18n="@@quotationStepClient">Elegir cliente</h2>
            <p i18n="@@quotationClientStepHelp">Selecciona quién recibirá la propuesta y define su vigencia.</p>
            <div class="wizard-support-row">
              <label class="search-control"><span i18n="@@searchClientLabel">Buscar cliente</span><input type="search" [value]="clientSearch()" (input)="clientSearch.set(inputValue($event))" placeholder="Nombre, email o RUT" i18n-placeholder="@@searchClientPlaceholder" /></label>
              <a class="secondary-link" [routerLink]="['/organizations', organizationId, 'clients', 'new']" target="_blank" rel="noopener" i18n="@@createClientNewTabAction">Crear cliente en otra pestaña</a>
              <button type="button" class="secondary" (click)="loadClients()" i18n="@@refreshClientsAction">Actualizar clientes</button>
            </div>
            <div class="field-grid">
              <label kaklen-form-field label="Cliente" i18n-label="@@clientLabel" controlId="quotation-form-clientId" required="auto" invalid="auto">
                <select kaklenControl formControlName="clientId" aria-describedby="quotation-client-error">
                  <option value="" i18n="@@selectClientOption">Selecciona cliente</option>
                  <option *ngFor="let client of filteredClients()" [value]="client.id">{{ client.displayName }}</option>
                </select>
                <kaklen-field-error id="quotation-client-error" [control]="form.controls.clientId" [attempted]="submitAttempted()" />
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
                <label kaklen-form-field label="Producto o servicio" i18n-label="@@catalogItemLabel" [controlId]="'quotation-item-catalogItemId-' + index" required="auto" invalid="auto"><select kaklenControl formControlName="catalogItemId" (change)="applyCatalogItem(index)"><option value="" i18n="@@customItemOption">Ítem personalizado</option><option *ngFor="let catalogItem of filteredCatalogItems()" [value]="catalogItem.id">{{ catalogItem.code }} · {{ catalogItem.name }}</option></select></label>
                <label kaklen-form-field label="Tipo" i18n-label="@@typeLabel" [controlId]="'quotation-item-type-' + index" required="auto" invalid="auto"><select kaklenControl formControlName="type"><option value="PRODUCT" i18n="@@productOption">Producto</option><option value="SERVICE" i18n="@@serviceOption">Servicio</option><option value="CUSTOM" i18n="@@customOption">Personalizado</option></select></label>
                <label kaklen-form-field label="Código" i18n-label="@@codeLabel" [controlId]="'quotation-item-code-' + index" required="auto" invalid="auto"><input kaklenControl formControlName="code" maxlength="80" /></label>
                <label kaklen-form-field label="Nombre" i18n-label="@@nameLabel" [controlId]="'quotation-item-name-' + index" required="auto" invalid="auto"><input kaklenControl formControlName="name" maxlength="160" /><kaklen-field-error [control]="item.controls.name" [attempted]="submitAttempted()" /></label>
                <label kaklen-form-field label="Cantidad" i18n-label="@@quantityLabel" [controlId]="'quotation-item-quantity-' + index" required="auto" invalid="auto"><input kaklenControl type="number" inputmode="decimal" min="0.001" step="0.001" formControlName="quantity" (input)="updateDiscountValidators(index)" /><kaklen-field-error [control]="item.controls.quantity" [attempted]="submitAttempted()" [invalidMessage]="quantityErrorLabel" /></label>
                <label kaklen-form-field label="Unidad" i18n-label="@@unitLabel" [controlId]="'quotation-item-unit-' + index" required="auto" invalid="auto"><input kaklenControl formControlName="unit" maxlength="40" /><kaklen-field-error [control]="item.controls.unit" [attempted]="submitAttempted()" /></label>
                <label kaklen-form-field label="Precio unitario" i18n-label="@@unitPriceLabel" [controlId]="'quotation-item-unitPrice-' + index" required="auto" invalid="auto"><input kaklenControl type="number" inputmode="decimal" min="0" step="0.01" formControlName="unitPrice" (input)="updateDiscountValidators(index)" /><kaklen-field-error [control]="item.controls.unitPrice" [attempted]="submitAttempted()" [invalidMessage]="moneyErrorLabel" /></label>
              </div>
              <div class="row-actions"><button type="button" class="secondary" (click)="duplicateItem(index)" i18n="@@duplicateLineButton">Duplicar línea</button><button type="button" class="secondary" (click)="removeItem(index)" [disabled]="items.length === 1" i18n="@@removeButton">Quitar</button></div>
            </article>
          </div>

          <div *ngIf="currentStep() === 3" class="wizard-stage">
            <h2 i18n="@@quotationStepAdjustments">Ajustar descuentos e impuestos</h2>
            <p i18n="@@quotationAdjustmentsStepHelp">Revisa cada concepto y aplica solo los ajustes necesarios.</p>
            <div class="field-grid">
              <label kaklen-form-field label="Fecha de emisión" i18n-label="@@issueDateLabel" controlId="quotation-form-issueDate" required="auto" invalid="auto"><input kaklenControl id="quotation-issue-date" type="date" formControlName="issueDate" aria-required="true" [attr.aria-invalid]="form.controls.issueDate.invalid && (form.controls.issueDate.touched || submitAttempted())" /><kaklen-field-error [control]="form.controls.issueDate" [attempted]="submitAttempted()" /></label>
              <label kaklen-form-field label="Válida hasta" i18n-label="@@validUntilLabel" controlId="quotation-form-validUntil" required="auto" invalid="auto"><input kaklenControl id="quotation-valid-until" type="date" formControlName="validUntil" aria-required="true" aria-describedby="quotation-valid-until-error" [attr.aria-invalid]="dateRangeInvalid()" /><small *ngIf="dateRangeInvalid()" id="quotation-valid-until-error" class="field-error" role="alert"><kaklen-icon name="x-circle" [size]="15" /><span>{{ dateErrorLabel }}</span></small><kaklen-field-error *ngIf="!form.hasError('dateOrder')" [control]="form.controls.validUntil" [attempted]="submitAttempted()" [invalidMessage]="dateErrorLabel" /></label>
              <label kaklen-form-field label="Moneda" i18n-label="@@currencyLabel" controlId="quotation-form-currency" required="auto" invalid="auto"><select kaklenControl formControlName="currency"><option value="CLP" i18n="@@currencyClpLabel">Peso chileno (CLP)</option><option value="USD" i18n="@@currencyUsdLabel">Dólar estadounidense (USD)</option><option value="BRL" i18n="@@currencyBrlLabel">Real brasileño (BRL)</option><option value="EUR" i18n="@@currencyEurLabel">Euro (EUR)</option></select></label>
              <label kaklen-form-field label="Descuento global (%)" i18n-label="@@globalDiscountLabel" controlId="quotation-form-globalDiscountPercent" required="auto" invalid="auto"><input kaklenControl type="number" inputmode="decimal" min="0" max="100" step="0.01" formControlName="globalDiscountPercent" /><small i18n="@@globalDiscountHelp">Se aplica a las líneas que no tienen un descuento específico.</small><kaklen-field-error [control]="form.controls.globalDiscountPercent" [attempted]="submitAttempted()" [invalidMessage]="discountErrorLabel" /></label>
            </div>
            <ng-container formArrayName="items">
              <article class="quotation-item-editor" *ngFor="let item of items.controls; let index = index" [formGroupName]="index">
                <div class="section-heading compact"><strong>{{ item.controls.name.value }}</strong><strong>{{ previewItemTotal(index) }}</strong></div>
                <div class="field-grid">
                  <label kaklen-form-field label="Tipo de descuento" i18n-label="@@discountTypeLabel" [controlId]="'quotation-item-discountType-' + index" required="auto" invalid="auto"><select kaklenControl formControlName="discountType" (change)="onDiscountTypeChange(index)"><option value="NONE" i18n="@@discountNoneOption">Sin descuento</option><option value="PERCENTAGE" i18n="@@discountPercentageOption">Porcentaje</option><option value="FIXED" i18n="@@discountFixedOption">Monto fijo</option></select></label>
                  <label kaklen-form-field label="Descuento" i18n-label="@@discountValueLabel" [controlId]="'quotation-item-discountValue-' + index" required="auto" invalid="auto"><input kaklenControl type="number" inputmode="decimal" min="0" [attr.max]="discountMaximum(index)" step="0.01" formControlName="discountValue" [attr.aria-disabled]="item.controls.discountValue.disabled" /><kaklen-field-error [control]="item.controls.discountValue" [attempted]="submitAttempted()" [invalidMessage]="discountErrorLabel" /></label>
                  <label kaklen-form-field label="Impuesto %" i18n-label="@@taxPercentLabel" [controlId]="'quotation-item-taxPercent-' + index" required="auto" invalid="auto"><input kaklenControl type="number" inputmode="decimal" min="0" max="100" step="0.01" formControlName="taxPercent" /><kaklen-field-error [control]="item.controls.taxPercent" [attempted]="submitAttempted()" [invalidMessage]="taxErrorLabel" /></label>
                </div>
              </article>
            </ng-container>
            <label kaklen-form-field label="Términos" i18n-label="@@termsLabel" controlId="quotation-form-terms" required="auto" invalid="auto"><textarea kaklenControl formControlName="terms" maxlength="2000" placeholder="Forma de pago, plazos y condiciones" i18n-placeholder="@@termsExample"></textarea></label>
            <label kaklen-form-field label="Notas" i18n-label="@@notesLabel" controlId="quotation-form-notes" required="auto" invalid="auto"><textarea kaklenControl formControlName="notes" maxlength="2000" placeholder="Información útil para el cliente" i18n-placeholder="@@quotationNotesExample"></textarea></label>
          </div>

          <div *ngIf="currentStep() === 4" class="wizard-stage">
            <h2 i18n="@@quotationStepReview">Revisar y guardar</h2>
            <p i18n="@@quotationReviewStepHelp">Confirma el cliente, los conceptos y el total antes de guardar.</p>
            <dl class="detail-grid quotation-review-overview"><div><dt i18n="@@clientLabel">Cliente</dt><dd>{{ selectedClient()?.displayName }}</dd></div><div><dt i18n="@@issueDateLabel">Fecha de emisión</dt><dd>{{ form.controls.issueDate.value }}</dd></div><div><dt i18n="@@validUntilLabel">Válida hasta</dt><dd>{{ form.controls.validUntil.value }}</dd></div><div><dt i18n="@@currencyLabel">Moneda</dt><dd>{{ form.controls.currency.value }}</dd></div><div><dt i18n="@@globalDiscountLabel">Descuento global (%)</dt><dd>{{ form.controls.globalDiscountPercent.value }}%</dd></div></dl>
            <div class="quotation-review-list"><article *ngFor="let item of items.controls; let index = index"><span><strong>{{ item.controls.name.value }}</strong><small>{{ item.controls.quantity.value }} {{ item.controls.unit.value }}</small></span><strong>{{ previewItemTotal(index) }}</strong></article></div>
            <p class="verification-note" i18n="@@quotationVerificationNote">Kaklen calculará y verificará automáticamente los totales al guardar.</p>
          </div>

          <p class="form-error" *ngIf="error()">{{ error() }}</p>
          <div class="wizard-actions">
            <button type="button" class="secondary" *ngIf="currentStep() > 1" (click)="previousStep()" i18n="@@backButton">Volver</button>
            <button type="button" *ngIf="currentStep() < 4" (click)="nextStep()" i18n="@@continueButton">Continuar</button>
            <button type="submit" *ngIf="currentStep() === 4" [disabled]="loading()"><kaklen-icon name="check" /><span>{{ loading() ? savingLabel : saveQuotationLabel }}</span></button>
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
  readonly submitAttempted = signal(false);
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
  readonly quantityErrorLabel = $localize`:@@quantityValidation:La cantidad debe ser mayor que 0 y tener máximo 3 decimales.`;
  readonly moneyErrorLabel = $localize`:@@moneyValidation:Ingresa un monto mayor o igual a 0 con máximo 2 decimales.`;
  readonly discountErrorLabel = $localize`:@@discountValidation:El descuento debe estar entre 0 y 100 cuando es porcentual.`;
  readonly taxErrorLabel = $localize`:@@taxValidation:El impuesto debe estar entre 0 y 100 y tener máximo 2 decimales.`;
  readonly dateErrorLabel = $localize`:@@quotationDateValidation:La fecha válida hasta debe ser posterior o igual a la fecha de emisión.`;
  readonly quotationProgressLabel = $localize`:@@quotationProgressLabel:Progreso de la cotización`;
  readonly wizardSteps = [
    { id: "client", label: $localize`:@@quotationStepClient:Elegir cliente` },
    { id: "items", label: $localize`:@@quotationStepItems:Agregar productos y servicios` },
    { id: "adjustments", label: $localize`:@@quotationStepAdjustments:Ajustar descuentos e impuestos` },
    { id: "review", label: $localize`:@@quotationStepReview:Revisar y guardar` }
  ] as const;
  readonly fieldLabels = {
    clientId: $localize`:@@clientLabel:Cliente`, issueDate: $localize`:@@issueDateLabel:Fecha de emisión`,
    validUntil: $localize`:@@validUntilLabel:Válida hasta`, currency: $localize`:@@currencyLabel:Moneda`,
    globalDiscountPercent: $localize`:@@globalDiscountLabel:Descuento global (%)`, items: $localize`:@@itemsLabel:Ítems`
  };
  readonly fieldIds = {
    clientId: "quotation-form-clientId",
    issueDate: "quotation-form-issueDate",
    validUntil: "quotation-form-validUntil",
    currency: "quotation-form-currency",
    globalDiscountPercent: "quotation-form-globalDiscountPercent"
  };
  readonly groupErrorFields = { dateOrder: "validUntil" };
  readonly fieldMessages = { validUntil: this.dateErrorLabel };
  readonly form = new FormGroup({
    clientId: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    issueDate: new FormControl(new Date().toISOString().slice(0, 10), { nonNullable: true, validators: [Validators.required] }),
    validUntil: new FormControl(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), { nonNullable: true, validators: [Validators.required] }),
    currency: new FormControl("CLP", { nonNullable: true, validators: [Validators.required] }),
    globalDiscountPercent: new FormControl(0, { nonNullable: true, validators: [decimalValidator(0, 100, 2)] }),
    notes: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    terms: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    items: new FormArray<ItemForm>([])
  }, { validators: [dateOrderValidator("issueDate", "validUntil")] });
  readonly wizardValidation = new WizardValidationState(this.form, {
    steps: {
      1: ["clientId"],
      2: ["items"],
      3: ["issueDate", "validUntil", "currency", "globalDiscountPercent", "items"],
      4: ["clientId", "issueDate", "validUntil", "currency", "globalDiscountPercent", "notes", "terms", "items"]
    },
    groupErrorFields: this.groupErrorFields,
    fieldIds: this.fieldIds
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
        globalDiscountPercent: Number(quotation.globalDiscountPercent),
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
    this.submitAttempted.set(true);
    this.items.controls.forEach((_item, index) => this.updateDiscountValidators(index));
    if (this.wizardValidation.attemptAll().length > 0) {
      this.wizardValidation.focusFirst(4);
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
    if (step === 3) this.items.controls.forEach((_item, index) => this.updateDiscountValidators(index));
    if (this.wizardValidation.attempt(step).length > 0) {
      this.wizardValidation.focusFirst(step);
      return;
    }
    this.currentStep.set(Math.min(4, step + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  previousStep(): void {
    this.currentStep.update((step) => Math.max(1, step - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  removeItem(index: number): void {
    this.items.removeAt(index);
  }

  onDiscountTypeChange(index: number): void {
    const item = this.items.at(index);
    if (item.controls.discountType.value === "NONE") {
      item.controls.discountValue.setValue(0);
    }
    this.updateDiscountValidators(index);
  }

  updateDiscountValidators(index: number): void {
    const item = this.items.at(index);
    const control = item.controls.discountValue;
    const type = item.controls.discountType.value;
    if (type === "NONE") {
      control.setValue(0, { emitEvent: false });
      control.disable({ emitEvent: false });
      return;
    }
    control.enable({ emitEvent: false });
    control.setValidators([
      decimalValidator(0, type === "PERCENTAGE" ? 100 : this.discountMaximum(index), 2)
    ]);
    control.updateValueAndValidity({ emitEvent: false });
  }

  discountMaximum(index: number): number {
    const item = this.items.at(index).getRawValue();
    return item.discountType === "PERCENTAGE"
      ? 100
      : Math.max(0, Number(item.quantity) * Number(item.unitPrice));
  }

  dateRangeInvalid(): boolean {
    return Boolean(
      this.form.hasError("dateOrder") &&
      (this.form.controls.validUntil.touched || this.submitAttempted())
    );
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
    return Number(this.calculation().subtotal);
  }

  discountTotal(): number {
    return Number(this.calculation().discountTotal);
  }

  taxTotal(): number {
    return Number(this.calculation().taxTotal);
  }

  grandTotal(): number {
    return Number(this.calculation().total);
  }

  async loadClients(): Promise<void> {
    this.clients.set((await this.clientsService.list(this.organizationId, { pageSize: 100 })).items);
  }

  private async loadCatalog(): Promise<void> {
    this.catalogItems.set((await this.catalogService.list(this.organizationId, { pageSize: 100 })).items);
  }

  private createItem(value?: Partial<QuotationItemPayload>): ItemForm {
    const item = new FormGroup({
      catalogItemId: new FormControl(value?.catalogItemId ?? "", { nonNullable: true }),
      type: new FormControl(value?.type ?? "CUSTOM", { nonNullable: true }),
      code: new FormControl(value?.code ?? "", { nonNullable: true }),
      name: new FormControl(value?.name ?? "", { nonNullable: true, validators: [Validators.required, trimmedRequired(), Validators.maxLength(160)] }),
      description: new FormControl(value?.description ?? "", { nonNullable: true, validators: [Validators.maxLength(2000)] }),
      quantity: new FormControl(value?.quantity ?? 1, { nonNullable: true, validators: [decimalValidator(0.001, 999_999_999.999, 3)] }),
      unit: new FormControl(value?.unit ?? "unidad", { nonNullable: true, validators: [Validators.required, trimmedRequired(), Validators.maxLength(40)] }),
      unitPrice: new FormControl(value?.unitPrice ?? 0, { nonNullable: true, validators: [decimalValidator(0, 99_999_999_999.99, 2)] }),
      discountType: new FormControl(value?.discountType ?? "NONE", { nonNullable: true }),
      discountValue: new FormControl(value?.discountValue ?? 0, { nonNullable: true, validators: [decimalValidator(0, 99_999_999_999.99, 2)] }),
      taxPercent: new FormControl(value?.taxPercent ?? 0, { nonNullable: true, validators: [decimalValidator(0, 100, 2)] })
    });
    if (item.controls.discountType.value === "NONE") {
      item.controls.discountValue.setValue(0, { emitEvent: false });
      item.controls.discountValue.disable({ emitEvent: false });
    }
    return item;
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

  private itemAmounts(index: number): { subtotal: number; discount: number; tax: number; total: number } {
    const line = this.calculation().lines[index] ?? { subtotal: "0.00", discountTotal: "0.00", taxTotal: "0.00", total: "0.00" };
    return { subtotal: Number(line.subtotal), discount: Number(line.discountTotal), tax: Number(line.taxTotal), total: Number(line.total) };
  }

  private normalize(value: string): string {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }

  private calculation(): QuotationMoneyResult {
    try {
      return calculateQuotationMoney(
        this.items.controls.map((item) => {
          const value = item.getRawValue();
          return {
            quantity: value.quantity,
            unitPrice: value.unitPrice,
            discountType: value.discountType,
            discountValue: value.discountValue,
            taxPercent: value.taxPercent
          };
        }),
        this.form.controls.globalDiscountPercent.value
      );
    } catch {
      const zero = {
        subtotal: "0.00",
        lineDiscountTotal: "0.00",
        globalDiscountTotal: "0.00",
        discountTotal: "0.00",
        taxableBase: "0.00",
        taxTotal: "0.00",
        total: "0.00"
      };
      return { ...zero, lines: this.items.controls.map(() => ({ ...zero })) };
    }
  }

  wizardAttempted(): boolean {
    return this.submitAttempted() || this.wizardValidation.isAttempted(this.currentStep());
  }

  activeStepPaths(): readonly string[] {
    return this.submitAttempted()
      ? this.wizardValidation.scopePaths(4)
      : this.wizardValidation.scopePaths(this.currentStep());
  }
}
