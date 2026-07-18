import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import type { MoneyDecimalInput } from "@kaklen/shared";
import { AssistantService } from "../assistant/assistant.service";
import { ProductAnalyticsService } from "../assistant/product-analytics.service";
import { Client } from "../clients/client.models";
import { ClientsService } from "../clients/clients.service";
import { EventPayload, EventTaskPriority } from "../events/event.models";
import { EventsService } from "../events/events.service";
import { OrganizationService } from "../organizations/organization.service";
import { Quotation } from "../quotations/quotation.models";
import { QuotationsService } from "../quotations/quotations.service";
import { ConfirmationDialogComponent } from "../shared/confirmation-dialog.component";
import { NotificationService } from "../shared/notifications/notification.service";
import { dateOrderValidator, decimalValidator, emailValidator, internationalPhoneValidator, moneyValidator, normalizeEmail, normalizePhone, trimmedRequired } from "../shared/forms/form-validators";
import { FieldErrorComponent, FormControlA11yDirective, FormErrorSummaryComponent,   FormFieldComponent
} from "../shared/forms/form-feedback.components";
import { WizardValidationState } from "../shared/forms/wizard-validation-state";
import { UiIconComponent } from "../shared/ui-icon.component";
import { MoneyInputDirective } from "../shared/forms/money-input.directive";

@Component({
  selector: "kaklen-event-form",
  standalone: true,
  imports: [FormFieldComponent, CommonModule, ReactiveFormsModule, ConfirmationDialogComponent, FieldErrorComponent, FormControlA11yDirective, FormErrorSummaryComponent, UiIconComponent, MoneyInputDirective],
  template: `
    <main class="dashboard-shell form-shell guided-event-shell">
      <section class="dashboard-header"><div><p class="eyebrow" i18n="@@eventsEyebrow">Eventos</p><h1>{{ eventId ? editTitle : createTitle }}</h1><p i18n="@@eventFormDescription">Define lo esencial ahora y completa la operación después.</p></div></section>

      <ol *ngIf="!eventId" class="wizard-steps event-wizard-steps" aria-label="Progreso del evento" i18n-aria-label="@@eventProgressLabel">
        <li *ngFor="let step of eventSteps" [class.active]="currentStep() === step.number" [class.complete]="currentStep() > step.number" [attr.aria-current]="currentStep() === step.number ? 'step' : null"><span>{{ step.number }}</span><strong>{{ step.label }}</strong></li>
      </ol>

      <form class="dashboard-panel form-panel wide-card" [formGroup]="form" (ngSubmit)="requestSave()">
        <kaklen-form-error-summary [form]="form" [attempted]="wizardAttempted()" [scopePaths]="activeStepPaths()" [labels]="fieldLabels" [fieldIds]="fieldIds" [groupErrorFields]="groupErrorFields" [messages]="fieldMessages" />
        <section class="wizard-stage" *ngIf="eventId || currentStep() === 1">
          <h2 i18n="@@eventStepMain">Información principal</h2><p i18n="@@eventStepMainHelp">Elige si partirás desde una cotización aprobada o desde cero.</p>
          <div class="event-source-choice" *ngIf="!eventId" role="radiogroup" aria-label="Origen del evento" i18n-aria-label="@@eventSourceLabel">
            <button type="button" [class.selected]="creationMode() === 'quotation'" (click)="setCreationMode('quotation')"><strong i18n="@@eventFromQuotationTitle">Desde cotización aprobada</strong><small i18n="@@eventFromQuotationHelp">Reutiliza cliente, presupuesto y contexto comercial.</small></button>
            <button type="button" [class.selected]="creationMode() === 'manual'" (click)="setCreationMode('manual')"><strong i18n="@@manualEventTitle">Evento manual</strong><small i18n="@@manualEventHelp">Comienza con información básica y complétala después.</small></button>
          </div>
          <div class="field-grid">
            <label kaklen-form-field *ngIf="creationMode() === 'quotation' || eventId" label="Cotización aprobada" i18n-label="@@approvedQuotationLabel" controlId="event-form-quotationId" required="auto" invalid="auto"><select kaklenControl formControlName="quotationId" (change)="applyQuotation()"><option value="" i18n="@@selectQuotationOption">Selecciona una cotización</option><option *ngFor="let quotation of approvedQuotations()" [value]="quotation.id">{{ quotation.number }} · {{ quotation.client.displayName }}</option></select></label>
            <label kaklen-form-field label="Nombre" i18n-label="@@nameLabel" controlId="event-form-name" required="auto" invalid="auto"><input kaklenControl formControlName="name" maxlength="160" placeholder="Ej. Lanzamiento de temporada" i18n-placeholder="@@eventNameExample" aria-describedby="event-name-error" /><kaklen-field-error id="event-name-error" [control]="form.controls.name" [attempted]="submitAttempted()" /></label>
            <label kaklen-form-field label="Cliente" i18n-label="@@clientLabel" controlId="event-form-clientId" required="auto" invalid="auto"><select kaklenControl formControlName="clientId"><option value="" i18n="@@noClientLabel">Sin cliente</option><option *ngFor="let client of clients()" [value]="client.id">{{ client.displayName }}</option></select></label>
          </div>
          <label kaklen-form-field label="Descripción" i18n-label="@@descriptionLabel" controlId="event-form-description" required="auto" invalid="auto"><textarea kaklenControl formControlName="description" rows="3" maxlength="2000" placeholder="Objetivo y alcance principal" i18n-placeholder="@@eventDescriptionExample"></textarea></label>
        </section>

        <section class="wizard-stage" *ngIf="eventId || currentStep() === 2">
          <h2 i18n="@@eventStepDateLocation">Fecha y ubicación</h2><p i18n="@@eventStepDateLocationHelp">Define cuándo y dónde ocurrirá el trabajo.</p>
          <div class="field-grid">
            <label kaklen-form-field label="Inicio" i18n-label="@@startAtLabel" controlId="event-form-startAt" required="auto" invalid="auto"><input kaklenControl type="datetime-local" formControlName="startAt" aria-describedby="event-start-error" /><kaklen-field-error id="event-start-error" [control]="form.controls.startAt" [attempted]="submitAttempted()" /></label>
            <label kaklen-form-field label="Término" i18n-label="@@endAtLabel" controlId="event-form-endAt" required="auto" invalid="auto"><input kaklenControl type="datetime-local" formControlName="endAt" aria-describedby="event-end-error" /><kaklen-field-error id="event-end-error" [control]="form.controls.endAt" [attempted]="submitAttempted()" [invalidMessage]="dateErrorLabel" /></label>
            <label kaklen-form-field label="Zona horaria" i18n-label="@@timezoneLabel" controlId="event-form-timezone" required="auto" invalid="auto"><select kaklenControl formControlName="timezone"><option value="America/Santiago" i18n="@@timezoneSantiagoLabel">Santiago, Chile</option><option value="America/Sao_Paulo" i18n="@@timezoneSaoPauloLabel">São Paulo, Brasil</option><option value="America/New_York" i18n="@@timezoneNewYorkLabel">Nueva York, Estados Unidos</option><option value="UTC" i18n="@@timezoneUtcLabel">Tiempo universal (UTC)</option></select></label>
            <label kaklen-form-field label="Lugar" i18n-label="@@venueNameLabel" controlId="event-form-venueName" required="auto" invalid="auto"><input kaklenControl formControlName="venueName" maxlength="160" placeholder="Ej. Centro de eventos" i18n-placeholder="@@venueExample" /></label>
            <label kaklen-form-field label="Dirección" i18n-label="@@addressLabel" controlId="event-form-address" required="auto" invalid="auto"><input kaklenControl formControlName="address" maxlength="240" /></label>
            <label kaklen-form-field label="Ciudad" i18n-label="@@cityLabel" controlId="event-form-city" required="auto" invalid="auto"><input kaklenControl formControlName="city" maxlength="120" /></label>
            <label kaklen-form-field label="Región" i18n-label="@@regionLabel" controlId="event-form-region" required="auto" invalid="auto"><input kaklenControl formControlName="region" maxlength="120" /></label>
          </div>
        </section>

        <section class="wizard-stage" *ngIf="eventId || currentStep() === 3">
          <h2 i18n="@@eventStepTeamResources">Equipo y recursos</h2><p i18n="@@eventStepTeamResourcesHelp">Estos datos son opcionales. Podrás agregar más participantes y recursos desde el evento.</p>
          <div class="field-grid">
            <label kaklen-form-field label="Contacto principal" i18n-label="@@contactNameLabel" controlId="event-form-contactName" required="auto" invalid="auto"><input kaklenControl formControlName="contactName" maxlength="160" /></label>
            <label kaklen-form-field label="Email contacto" i18n-label="@@contactEmailLabel" controlId="event-form-contactEmail" required="auto" invalid="auto"><input kaklenControl type="email" inputmode="email" maxlength="254" formControlName="contactEmail" aria-describedby="event-email-error" /><kaklen-field-error id="event-email-error" [control]="form.controls.contactEmail" [attempted]="submitAttempted()" /></label>
            <label kaklen-form-field label="Teléfono contacto" i18n-label="@@contactPhoneLabel" controlId="event-form-contactPhone" required="auto" invalid="auto"><input kaklenControl type="tel" inputmode="tel" maxlength="40" formControlName="contactPhone" aria-describedby="event-phone-error" /><kaklen-field-error id="event-phone-error" [control]="form.controls.contactPhone" [attempted]="submitAttempted()" /></label>
            <label kaklen-form-field label="Participante inicial" i18n-label="@@initialParticipantLabel" controlId="event-form-initialParticipant" required="auto" invalid="auto"><input kaklenControl formControlName="initialParticipant" maxlength="160" placeholder="Nombre del participante" i18n-placeholder="@@participantNameExample" /></label>
            <label kaklen-form-field label="Recurso inicial" i18n-label="@@initialResourceLabel" controlId="event-form-initialResource" required="auto" invalid="auto"><input kaklenControl formControlName="initialResource" maxlength="160" placeholder="Ej. Equipo de sonido" i18n-placeholder="@@resourceNameExample" /></label>
            <label kaklen-form-field label="Cantidad del recurso" i18n-label="@@resourceQuantityLabel" controlId="event-form-resourceQuantity" required="auto" invalid="auto" fieldType="quantity"><input kaklenControl type="number" inputmode="decimal" min="0.001" step="0.001" formControlName="resourceQuantity" /><kaklen-field-error [control]="form.controls.resourceQuantity" [attempted]="submitAttempted()" /></label>
            <label kaklen-form-field label="Moneda" i18n-label="@@currencyLabel" controlId="event-form-currency" required="auto" invalid="auto"><select kaklenControl formControlName="currency" (change)="onCurrencyChange()"><option value="CLP" i18n="@@currencyClpLabel">Peso chileno (CLP)</option><option value="USD" i18n="@@currencyUsdLabel">Dólar estadounidense (USD)</option><option value="BRL" i18n="@@currencyBrlLabel">Real brasileño (BRL)</option><option value="EUR" i18n="@@currencyEurLabel">Euro (EUR)</option></select></label>
            <label kaklen-form-field label="Presupuesto" i18n-label="@@budgetLabel" controlId="event-form-budget" required="auto" invalid="auto" fieldType="money" [currency]="form.controls.currency.value"><input kaklenControl kaklenMoneyInput [currency]="form.controls.currency.value" type="number" inputmode="decimal" min="0" formControlName="budget" /><kaklen-field-error [control]="form.controls.budget" [attempted]="submitAttempted()" /></label>
          </div>
        </section>

        <section class="wizard-stage" *ngIf="eventId || currentStep() === 4">
          <h2 i18n="@@eventStepTasks">Tareas iniciales</h2><p i18n="@@eventStepTasksHelp">Puedes guardar sin tareas y agregarlas cuando planifiques la ejecución.</p>
          <div class="field-grid"><label kaklen-form-field label="Primera tarea" i18n-label="@@initialTaskLabel" controlId="event-form-initialTask" required="auto" invalid="auto"><input kaklenControl formControlName="initialTask" maxlength="160" placeholder="Ej. Confirmar proveedores" i18n-placeholder="@@initialTaskExample" /></label><label kaklen-form-field label="Prioridad" i18n-label="@@priorityLabel" controlId="event-form-initialTaskPriority" required="auto" invalid="auto"><select kaklenControl formControlName="initialTaskPriority"><option value="LOW" i18n="@@priorityLow">Baja</option><option value="MEDIUM" i18n="@@priorityMedium">Media</option><option value="HIGH" i18n="@@priorityHigh">Alta</option><option value="URGENT" i18n="@@priorityUrgent">Urgente</option></select></label></div>
          <label kaklen-form-field label="Notas" i18n-label="@@notesLabel" controlId="event-form-notes" required="auto" invalid="auto"><textarea kaklenControl formControlName="notes" rows="3" maxlength="2000"></textarea></label>
        </section>

        <section class="wizard-stage event-review" *ngIf="!eventId && currentStep() === 5">
          <h2 i18n="@@eventStepReview">Revisión</h2><p i18n="@@eventStepReviewHelp">Confirma la información. El evento se guardará como borrador para que puedas seguir planificando.</p>
          <dl class="detail-grid"><div><dt i18n="@@eventSourceLabel">Origen del evento</dt><dd>{{ creationMode() === 'quotation' ? fromQuotationLabel : manualLabel }}</dd></div><div><dt i18n="@@nameLabel">Nombre</dt><dd>{{ form.controls.name.value }}</dd></div><div><dt i18n="@@clientLabel">Cliente</dt><dd>{{ selectedClientName() }}</dd></div><div><dt i18n="@@startAtLabel">Inicio</dt><dd>{{ form.controls.startAt.value }}</dd></div><div><dt i18n="@@venueNameLabel">Lugar</dt><dd>{{ form.controls.venueName.value || emptyValueLabel }}</dd></div><div><dt i18n="@@initialTaskLabel">Primera tarea</dt><dd>{{ form.controls.initialTask.value || emptyValueLabel }}</dd></div></dl>
          <aside class="next-after-create"><strong i18n="@@afterEventCreationTitle">Después de crear</strong><p i18n="@@afterEventCreationHelp">Podrás agregar más tareas, asignar participantes y confirmar el evento desde su detalle.</p></aside>
        </section>

        <p class="form-error" *ngIf="error()">{{ error() }}</p>
        <div class="row-actions wizard-actions">
          <button type="button" class="secondary" *ngIf="!eventId && currentStep() > 1" (click)="previousStep()" i18n="@@backButton">Volver</button>
          <button type="button" *ngIf="!eventId && currentStep() < 5" (click)="nextStep()" i18n="@@continueButton">Continuar</button>
          <button type="submit" *ngIf="eventId || currentStep() === 5" [disabled]="loading()"><kaklen-icon name="check" /><span>{{ loading() ? savingLabel : (eventId ? saveChangesLabel : createDraftLabel) }}</span></button>
          <button type="button" class="secondary" (click)="back()" i18n="@@cancelButton">Cancelar</button>
        </div>
      </form>

      <kaklen-confirmation-dialog [open]="confirmationOpen()" [busy]="loading()" [title]="quotationConfirmTitle" [description]="quotationConfirmDescription" [confirmLabel]="createEventLabel" (confirm)="saveConfirmed()" (cancel)="confirmationOpen.set(false)" />
    </main>
  `
})
export class EventFormComponent implements OnInit, OnDestroy {
  readonly loading = signal(false);
  readonly error = signal("");
  readonly submitAttempted = signal(false);
  readonly currentStep = signal(1);
  readonly creationMode = signal<"manual" | "quotation">("manual");
  readonly confirmationOpen = signal(false);
  readonly clients = signal<Client[]>([]);
  readonly approvedQuotations = signal<Quotation[]>([]);
  readonly createTitle = $localize`:@@createEventTitle:Nuevo evento`;
  readonly editTitle = $localize`:@@editEventTitle:Editar evento`;
  readonly saveChangesLabel = $localize`:@@saveChangesButton:Guardar cambios`;
  readonly createDraftLabel = $localize`:@@createEventDraftButton:Crear evento en borrador`;
  readonly savingLabel = $localize`:@@savingButton:Guardando...`;
  readonly fromQuotationLabel = $localize`:@@eventFromQuotationTitle:Desde cotización aprobada`;
  readonly manualLabel = $localize`:@@manualEventTitle:Evento manual`;
  readonly emptyValueLabel = $localize`:@@emptyValueLabel:Sin informar`;
  readonly quotationConfirmTitle = $localize`:@@createFromQuotationConfirmTitle:Crear evento desde esta cotización`;
  readonly quotationConfirmDescription = $localize`:@@createFromQuotationConfirmDescription:Kaklen reutilizará el cliente, el presupuesto y el contexto de la cotización aprobada. Solo puede existir un evento vinculado a ella.`;
  readonly createEventLabel = $localize`:@@createEventConfirmButton:Crear evento`;
  readonly dateErrorLabel = $localize`:@@eventDateValidation:La fecha de término debe ser posterior a la fecha de inicio.`;
  readonly fieldLabels = {
    clientId: $localize`:@@clientLabel:Cliente`, quotationId: $localize`:@@approvedQuotationLabel:Cotización aprobada`,
    name: $localize`:@@nameLabel:Nombre`, description: $localize`:@@descriptionLabel:Descripción`,
    startAt: $localize`:@@startAtLabel:Inicio`, endAt: $localize`:@@endAtLabel:Término`, timezone: $localize`:@@timezoneLabel:Zona horaria`,
    contactName: $localize`:@@contactNameLabel:Contacto principal`, contactEmail: $localize`:@@contactEmailLabel:Email contacto`,
    contactPhone: $localize`:@@contactPhoneLabel:Teléfono contacto`, budget: $localize`:@@budgetLabel:Presupuesto`,
    venueName: $localize`:@@venueNameLabel:Lugar`, address: $localize`:@@addressLabel:Dirección`, city: $localize`:@@cityLabel:Ciudad`,
    region: $localize`:@@regionLabel:Región`, initialParticipant: $localize`:@@initialParticipantLabel:Participante inicial`,
    initialResource: $localize`:@@initialResourceLabel:Recurso inicial`, resourceQuantity: $localize`:@@resourceQuantityLabel:Cantidad del recurso`,
    currency: $localize`:@@currencyLabel:Moneda`, initialTask: $localize`:@@initialTaskLabel:Primera tarea`,
    initialTaskPriority: $localize`:@@priorityLabel:Prioridad`, notes: $localize`:@@notesLabel:Notas`
  };
  readonly fieldIds = {
    quotationId: "event-form-quotationId", name: "event-form-name", clientId: "event-form-clientId",
    description: "event-form-description", startAt: "event-form-startAt", endAt: "event-form-endAt",
    timezone: "event-form-timezone", venueName: "event-form-venueName", address: "event-form-address",
    city: "event-form-city", region: "event-form-region", contactName: "event-form-contactName",
    contactEmail: "event-form-contactEmail", contactPhone: "event-form-contactPhone",
    initialParticipant: "event-form-initialParticipant", initialResource: "event-form-initialResource",
    resourceQuantity: "event-form-resourceQuantity", currency: "event-form-currency", budget: "event-form-budget",
    initialTask: "event-form-initialTask", initialTaskPriority: "event-form-initialTaskPriority", notes: "event-form-notes"
  };
  readonly groupErrorFields = { dateOrder: "endAt" };
  readonly fieldMessages = { endAt: this.dateErrorLabel };
  readonly eventSteps = [
    { number: 1, label: $localize`:@@eventStepMain:Información principal` },
    { number: 2, label: $localize`:@@eventStepDateLocation:Fecha y ubicación` },
    { number: 3, label: $localize`:@@eventStepTeamResources:Equipo y recursos` },
    { number: 4, label: $localize`:@@eventStepTasks:Tareas iniciales` },
    { number: 5, label: $localize`:@@eventStepReview:Revisión` }
  ];
  organizationId = "";
  eventId = "";
  private initialEventCreated = false;
  private wizardCompleted = false;
  private validationCurrency = "CLP";
  readonly form = new FormGroup({
    clientId: new FormControl("", { nonNullable: true }), quotationId: new FormControl("", { nonNullable: true }),
    name: new FormControl("", { nonNullable: true, validators: [Validators.required, trimmedRequired(), Validators.maxLength(160)] }), description: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    startAt: new FormControl("", { nonNullable: true, validators: [Validators.required] }), endAt: new FormControl("", { nonNullable: true, validators: [Validators.required] }), timezone: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    venueName: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(160)] }), address: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(240)] }), city: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(120)] }), region: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(120)] }),
    currency: new FormControl("", { nonNullable: true, validators: [Validators.required, Validators.maxLength(3)] }), budget: new FormControl<MoneyDecimalInput | null>(null, { validators: [moneyValidator(() => this.validationCurrency, undefined, false)] }), contactName: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(160)] }), contactEmail: new FormControl("", { nonNullable: true, validators: [emailValidator()] }), contactPhone: new FormControl("", { nonNullable: true, validators: [internationalPhoneValidator()] }),
    initialParticipant: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(160)] }), initialResource: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(160)] }), resourceQuantity: new FormControl(1, { nonNullable: true, validators: [Validators.required, decimalValidator(0.001, 999_999_999.999, 3)] }),
    initialTask: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(160)] }), initialTaskPriority: new FormControl<EventTaskPriority>("MEDIUM", { nonNullable: true }), notes: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(2000)] })
  }, { validators: [dateOrderValidator("startAt", "endAt", false)] });
  readonly wizardValidation = new WizardValidationState(this.form, {
    steps: {
      1: ["quotationId", "name", "clientId", "description"],
      2: ["startAt", "endAt", "timezone", "venueName", "address", "city", "region"],
      3: ["contactName", "contactEmail", "contactPhone", "initialParticipant", "initialResource", "resourceQuantity", "currency", "budget"],
      4: ["initialTask", "initialTaskPriority", "notes"],
      5: ["quotationId", "name", "clientId", "description", "startAt", "endAt", "timezone", "venueName", "address", "city", "region", "contactName", "contactEmail", "contactPhone", "initialParticipant", "initialResource", "resourceQuantity", "currency", "budget", "initialTask", "initialTaskPriority", "notes"]
    },
    groupErrorFields: this.groupErrorFields,
    fieldIds: this.fieldIds
  });

  constructor(
    private readonly route: ActivatedRoute, private readonly router: Router, private readonly organizationService: OrganizationService,
    private readonly clientsService: ClientsService, private readonly quotationsService: QuotationsService, private readonly eventsService: EventsService,
    private readonly notifications: NotificationService, private readonly assistantService: AssistantService, private readonly analytics: ProductAnalyticsService
  ) {}

  async ngOnInit(): Promise<void> {
    this.organizationId = this.route.snapshot.paramMap.get("organizationId") ?? "";
    this.eventId = this.route.snapshot.paramMap.get("eventId") ?? "";
    await this.organizationService.setActiveOrganization(this.organizationId);
    const organization = this.organizationService.activeOrganization();
    const start = new Date(Date.now() + 86400000); start.setHours(10, 0, 0, 0);
    const end = new Date(start.getTime() + 2 * 3600000);
    this.form.patchValue({ timezone: organization?.timezone ?? "America/Santiago", currency: organization?.currency ?? "CLP", startAt: this.toLocalInput(start.toISOString()), endAt: this.toLocalInput(end.toISOString()) });
    this.onCurrencyChange();
    await this.loadOptions();
    const quotationId = this.route.snapshot.queryParamMap.get("quotationId");
    const clientId = this.route.snapshot.queryParamMap.get("clientId");
    if (quotationId) { this.setCreationMode("quotation"); this.form.controls.quotationId.setValue(quotationId); this.applyQuotation(); }
    if (clientId) this.form.controls.clientId.setValue(clientId);
    if (this.eventId) await this.loadEvent();
    else this.initialEventCreated = (await this.assistantService.activation(this.organizationId)).completedSteps.includes("first_event_created");
  }

  ngOnDestroy(): void {
    if (!this.eventId && this.form.dirty && !this.wizardCompleted) this.analytics.track("wizard_abandoned", { flow: "event", step: String(this.currentStep()) });
  }

  setCreationMode(mode: "manual" | "quotation"): void {
    this.creationMode.set(mode);
    const quotation = this.form.controls.quotationId;
    quotation.setValidators(mode === "quotation" ? [Validators.required] : []);
    if (mode === "manual") quotation.setValue("");
    quotation.updateValueAndValidity({ emitEvent: false });
  }

  applyQuotation(): void {
    const quotation = this.approvedQuotations().find((item) => item.id === this.form.controls.quotationId.value);
    if (!quotation) return;
    this.form.patchValue({ clientId: quotation.clientId, name: this.form.controls.name.value || `${$localize`:@@eventForQuotationPrefix:Evento`} ${quotation.number}`, budget: quotation.total, currency: quotation.currency });
    this.onCurrencyChange();
  }

  onCurrencyChange(): void {
    this.validationCurrency = this.form.controls.currency.value || "CLP";
    this.form.controls.budget.updateValueAndValidity();
  }

  nextStep(): void {
    const step = this.currentStep();
    if (this.wizardValidation.attempt(step).length > 0) { this.wizardValidation.focusFirst(step); return; }
    this.currentStep.update((current) => Math.min(5, current + 1)); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  previousStep(): void { this.currentStep.update((step) => Math.max(1, step - 1)); }

  requestSave(): void {
    this.submitAttempted.set(true);
    if (this.wizardValidation.attemptAll().length > 0) { this.wizardValidation.focusFirst(5); return; }
    if (!this.eventId && this.creationMode() === "quotation") this.confirmationOpen.set(true);
    else void this.saveConfirmed();
  }

  async saveConfirmed(): Promise<void> {
    if (this.loading()) return;
    this.confirmationOpen.set(false); this.loading.set(true); this.error.set("");
    try {
      const quotationId = this.form.controls.quotationId.value;
      const event = this.eventId ? await this.eventsService.update(this.organizationId, this.eventId, this.payload()) : quotationId ? await this.eventsService.createFromQuotation(this.organizationId, quotationId, this.payload()) : await this.eventsService.create(this.organizationId, this.payload());
      const optionalOperationsComplete = this.eventId ? true : await this.createOptionalOperations(event.id);
      this.notifications.success(this.eventId ? $localize`:@@eventUpdatedSuccess:Evento actualizado correctamente.` : $localize`:@@eventCreatedSuccess:Evento creado correctamente. Agrega tareas, participantes o confirma el evento cuando estés listo.`);
      if (!optionalOperationsComplete) this.notifications.warning($localize`:@@eventOptionalSetupWarning:El evento fue creado, pero no fue posible agregar todos los datos opcionales. Puedes completarlos desde el detalle.`);
      if (!this.eventId) { this.wizardCompleted = true; this.analytics.track("wizard_completed", { flow: "event", step: "review" }); if (!this.initialEventCreated) this.analytics.track("first_event_created", { flow: "event" }); }
      await this.router.navigate(["/organizations", this.organizationId, "events", event.id]);
    } catch (error) { this.notifications.fromError(error); this.error.set($localize`:@@eventSaveError:No fue posible guardar el evento.`); }
    finally { this.loading.set(false); }
  }

  back(): void { void this.router.navigate(["/organizations", this.organizationId, "events"]); }
  selectedClientName(): string { return this.clients().find((item) => item.id === this.form.controls.clientId.value)?.displayName ?? this.emptyValueLabel; }

  private async loadOptions(): Promise<void> {
    const [clients, quotations] = await Promise.all([this.clientsService.list(this.organizationId, { pageSize: 100 }), this.quotationsService.list(this.organizationId, { status: "APPROVED", pageSize: 100 })]);
    this.clients.set(clients.items); this.approvedQuotations.set(quotations.items);
  }

  private async loadEvent(): Promise<void> {
    const event = await this.eventsService.get(this.organizationId, this.eventId);
    this.setCreationMode(event.quotationId ? "quotation" : "manual");
    this.form.patchValue({ clientId: event.clientId ?? "", quotationId: event.quotationId ?? "", name: event.name, description: event.description ?? "", startAt: this.toLocalInput(event.startAt), endAt: this.toLocalInput(event.endAt), timezone: event.timezone, venueName: event.venueName ?? "", address: event.address ?? "", city: event.city ?? "", region: event.region ?? "", currency: event.currency, budget: event.budget, contactName: event.contactName ?? "", contactEmail: event.contactEmail ?? "", contactPhone: event.contactPhone ?? "", notes: event.notes ?? "" });
    this.onCurrencyChange();
  }

  private payload(): EventPayload {
    const value = this.form.getRawValue();
    return { clientId: value.clientId || null, quotationId: value.quotationId || undefined, name: value.name.trim(), description: value.description.trim() || null, startAt: new Date(value.startAt).toISOString(), endAt: new Date(value.endAt).toISOString(), timezone: value.timezone, venueName: value.venueName.trim() || null, address: value.address.trim() || null, city: value.city.trim() || null, region: value.region.trim() || null, currency: value.currency, budget: value.budget, contactName: value.contactName.trim() || null, contactEmail: normalizeEmail(value.contactEmail) || null, contactPhone: normalizePhone(value.contactPhone) || null, notes: value.notes.trim() || null };
  }

  private async createOptionalOperations(eventId: string): Promise<boolean> {
    const value = this.form.getRawValue();
    const operations: Promise<unknown>[] = [];
    if (value.initialParticipant.trim()) operations.push(this.eventsService.createParticipant(this.organizationId, eventId, { externalName: value.initialParticipant.trim(), role: "STAFF" }));
    if (value.initialResource.trim()) operations.push(this.eventsService.createResource(this.organizationId, eventId, { name: value.initialResource.trim(), quantity: value.resourceQuantity, unit: "unidad" }));
    if (value.initialTask.trim()) operations.push(this.eventsService.createTask(this.organizationId, eventId, { title: value.initialTask.trim(), priority: value.initialTaskPriority }));
    const results = await Promise.allSettled(operations);
    return results.every((result) => result.status === "fulfilled");
  }

  private toLocalInput(value: string): string { const date = new Date(value); const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }

  wizardAttempted(): boolean {
    return this.submitAttempted() || this.wizardValidation.isAttempted(this.currentStep());
  }

  activeStepPaths(): readonly string[] {
    return this.eventId || this.submitAttempted()
      ? this.wizardValidation.scopePaths(5)
      : this.wizardValidation.scopePaths(this.currentStep());
  }
}
