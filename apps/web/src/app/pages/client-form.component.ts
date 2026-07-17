import { CommonModule } from "@angular/common";
import { Component, DestroyRef, OnDestroy, OnInit, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { ClientStatus, ClientType } from "../clients/client.models";
import { ClientPayload, ClientsService } from "../clients/clients.service";
import { OrganizationService } from "../organizations/organization.service";
import { chileanRutValidator, formatChileanRut, normalizeChileanRut } from "../shared/validators/chilean-rut.validator";
import { NotificationService } from "../shared/notifications/notification.service";
import { AssistantService } from "../assistant/assistant.service";
import { ProductAnalyticsService } from "../assistant/product-analytics.service";
import {
  emailValidator,
  internationalPhoneValidator,
  normalizeEmail,
  normalizePhone,
  trimmedRequired
} from "../shared/forms/form-validators";
import {
  FieldErrorComponent,
  FormControlA11yDirective,
  FormErrorSummaryComponent,
  FormFieldComponent,
  WizardStepIndicatorComponent
} from "../shared/forms/form-feedback.components";
import { WizardValidationState } from "../shared/forms/wizard-validation-state";
import { UiIconComponent } from "../shared/ui-icon.component";
import { countryBusinessPolicy } from "@kaklen/shared";
import { CHILE_REGIONS } from "../shared/forms/chile-locations";

@Component({
  selector: "kaklen-client-form",
  standalone: true,
  imports: [FormFieldComponent, CommonModule, ReactiveFormsModule, RouterLink, FieldErrorComponent, FormControlA11yDirective, FormErrorSummaryComponent, WizardStepIndicatorComponent, UiIconComponent],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header">
        <div>
          <h1>{{ titleLabel() }}</h1>
        </div>
        <a class="ghost button-link" [routerLink]="['/organizations', organizationId, 'clients']"><kaklen-icon name="arrow-left" /><span i18n="@@backLink">Volver</span></a>
      </section>

      <section class="dashboard-panel">
        <form [formGroup]="clientForm" (ngSubmit)="save()">
          <kaklen-wizard-steps *ngIf="!clientId" class="client-wizard-steps" [steps]="wizardSteps" [currentStep]="currentStep()" [ariaLabel]="clientProgressLabel" />
          <kaklen-form-error-summary [form]="clientForm" [attempted]="wizardAttempted()" [scopePaths]="activeStepPaths()" [labels]="fieldLabels" [fieldIds]="fieldIds" />

          <fieldset class="form-section wizard-stage" *ngIf="clientId || currentStep() === 1">
            <legend i18n="@@mainInformationSection">Información principal</legend>
            <div class="field-grid">
              <label kaklen-form-field label="Tipo" i18n-label="@@typeLabel" controlId="client-form-type" required="auto" invalid="auto">
                <select kaklenControl formControlName="type">
                  <option value="NATURAL_PERSON" i18n="@@naturalPersonOption">Persona natural</option>
                  <option value="LEGAL_ENTITY" i18n="@@companyOption">Empresa</option>
                </select>
              </label>
              <label kaklen-form-field label="Estado" i18n-label="@@statusLabel" controlId="client-form-status" required="auto" invalid="auto">
                <select kaklenControl formControlName="status">
                  <option value="LEAD" i18n="@@leadOption">Prospecto</option>
                  <option value="ACTIVE" i18n="@@activeOption">Activo</option>
                  <option value="INACTIVE" i18n="@@inactiveOption">Inactivo</option>
                </select>
              </label>
            </div>
            <div class="field-grid" *ngIf="clientForm.controls.type.value === 'NATURAL_PERSON'">
              <label kaklen-form-field label="Nombre" i18n-label="@@firstNameLabel" controlId="client-form-firstName" required="auto" invalid="auto">
                <input kaklenControl formControlName="firstName" maxlength="80" placeholder="Ej. Camila" i18n-placeholder="@@firstNameExample" aria-describedby="client-first-name-error" />
                <kaklen-field-error id="client-first-name-error" [control]="clientForm.controls.firstName" [attempted]="submitAttempted()" />
              </label>
              <label kaklen-form-field label="Apellido" i18n-label="@@lastNameLabel" controlId="client-form-lastName" required="auto" invalid="auto">
                <input kaklenControl formControlName="lastName" maxlength="80" placeholder="Ej. Soto" i18n-placeholder="@@lastNameExample" aria-describedby="client-last-name-error" />
                <kaklen-field-error id="client-last-name-error" [control]="clientForm.controls.lastName" [attempted]="submitAttempted()" />
              </label>
            </div>
            <label kaklen-form-field *ngIf="clientForm.controls.type.value === 'LEGAL_ENTITY'" label="Razón social" i18n-label="@@legalNameLabel" controlId="client-form-legalName" required="auto" invalid="auto">
              <input kaklenControl formControlName="legalName" maxlength="160" placeholder="Ej. Comercial Andes SpA" i18n-placeholder="@@legalNameExample" aria-describedby="client-legal-name-error" />
              <kaklen-field-error id="client-legal-name-error" [control]="clientForm.controls.legalName" [attempted]="submitAttempted()" />
            </label>
            <label kaklen-form-field label="RUT o identificación tributaria" i18n-label="@@taxIdLabel" controlId="client-form-taxId" required="auto" invalid="auto">
              <input kaklenControl id="client-tax-id" formControlName="taxId" maxlength="40" (input)="formatRut()" placeholder="12.345.678-5" aria-describedby="client-tax-id-help client-tax-id-error" [attr.aria-required]="currentPolicy().taxIdRequired" [attr.aria-invalid]="clientForm.controls.taxId.invalid && (clientForm.controls.taxId.touched || submitAttempted())" />
              <small id="client-tax-id-help" i18n="@@rutFormatHelp">Formato esperado: 12.345.678-5.</small>
              <kaklen-field-error id="client-tax-id-error" [control]="clientForm.controls.taxId" [attempted]="submitAttempted()" />
            </label>
          </fieldset>

          <fieldset class="form-section wizard-stage" *ngIf="clientId || currentStep() === 2">
            <legend i18n="@@contactSection">Contacto</legend>
            <div class="field-grid">
              <label kaklen-form-field label="Email" i18n-label="@@emailLabel" controlId="client-form-email" required="auto" invalid="auto">
                <input kaklenControl type="email" formControlName="email" maxlength="254" inputmode="email" placeholder="nombre@empresa.cl" aria-describedby="client-email-error" />
                <kaklen-field-error id="client-email-error" [control]="clientForm.controls.email" [attempted]="submitAttempted()" />
              </label>
              <div class="phone-control">
                <label kaklen-form-field label="Prefijo" i18n-label="@@phonePrefixLabel" controlId="client-phone-prefix" required="auto" invalid="auto">
                  <select kaklenControl formControlName="phonePrefix"><option value="+56">+56</option><option value="+54">+54</option><option value="+55">+55</option><option value="+1">+1</option></select>
                </label>
                <label kaklen-form-field label="Teléfono" i18n-label="@@phoneLabel" controlId="client-phone" required="auto" invalid="auto">
                  <input kaklenControl type="tel" inputmode="tel" formControlName="phone" maxlength="40" placeholder="9 1234 5678" />
                </label>
              </div>
              <label kaklen-form-field label="WhatsApp" i18n-label="@@whatsappLabel" controlId="client-form-whatsapp" required="auto" invalid="auto">
                <input kaklenControl id="client-whatsapp" type="tel" inputmode="tel" formControlName="whatsapp" maxlength="40" [placeholder]="currentPolicy().phoneExample" aria-describedby="client-whatsapp-error" [attr.aria-required]="currentPolicy().whatsappRequired" [attr.aria-invalid]="clientForm.controls.whatsapp.invalid && (clientForm.controls.whatsapp.touched || submitAttempted())" />
                <kaklen-field-error id="client-whatsapp-error" [control]="clientForm.controls.whatsapp" [attempted]="submitAttempted()" />
              </label>
            </div>
          </fieldset>

          <fieldset class="form-section wizard-stage" *ngIf="clientId || currentStep() === 3">
            <legend i18n="@@addressSection">Dirección</legend>
            <div class="field-grid">
              <label kaklen-form-field label="País" i18n-label="@@countryLabel" controlId="client-form-country" required="auto" invalid="auto">
                <select kaklenControl formControlName="country">
                  <option value="CL" i18n="@@countryChileLabel">Chile</option>
                  <option value="AR" i18n="@@countryArgentinaLabel">Argentina</option>
                  <option value="BR" i18n="@@countryBrazilLabel">Brasil</option>
                  <option value="MX" i18n="@@countryMexicoLabel">México</option>
                  <option value="US" i18n="@@countryUnitedStatesLabel">Estados Unidos</option>
                </select>
              </label>
              <label kaklen-form-field label="Región" i18n-label="@@regionLabel" controlId="client-form-region" required="auto" invalid="auto">
                <select kaklenControl formControlName="region">
                  <option value="" i18n="@@selectRegionOption">Selecciona una región</option>
                  <option *ngFor="let region of regions" [value]="region">{{ region }}</option>
                </select>
              </label>
              <label kaklen-form-field label="Comuna o ciudad" i18n-label="@@cityOrCommuneLabel" controlId="client-form-city" required="auto" invalid="auto">
                <select kaklenControl formControlName="city">
                  <option value="" i18n="@@selectCityOption">Selecciona una comuna o ciudad</option>
                  <option *ngFor="let city of availableCities()" [value]="city">{{ city }}</option>
                </select>
              </label>
              <label kaklen-form-field label="Dirección" i18n-label="@@addressLabel" controlId="client-form-address" required="auto" invalid="auto">
                <input kaklenControl formControlName="address" maxlength="240" placeholder="Calle, número, oficina" i18n-placeholder="@@addressExample" />
              </label>
            </div>
          </fieldset>

          <fieldset class="form-section wizard-stage" *ngIf="clientId || currentStep() === 3">
            <legend i18n="@@additionalInformationSection">Información adicional</legend>
            <label kaklen-form-field label="Notas" i18n-label="@@notesLabel" controlId="client-form-notes" required="auto" invalid="auto">
              <textarea kaklenControl formControlName="notes" maxlength="2000" i18n-placeholder="@@clientNotesPlaceholder" placeholder="Preferencias, contexto comercial o información relevante"></textarea>
            </label>
          </fieldset>

          <section class="form-section client-review wizard-stage" *ngIf="!clientId && currentStep() === 4">
            <h2 i18n="@@clientStepReview">Revisión</h2>
            <p i18n="@@clientReviewHelp">Confirma la información principal. Podrás completar o editar los datos más adelante.</p>
            <dl class="detail-grid">
              <div><dt i18n="@@typeLabel">Tipo</dt><dd>{{ clientForm.controls.type.value === 'LEGAL_ENTITY' ? companyLabel : naturalPersonLabel }}</dd></div>
              <div><dt i18n="@@nameLabel">Nombre</dt><dd>{{ reviewName() }}</dd></div>
              <div><dt i18n="@@taxIdLabel">RUT o identificación tributaria</dt><dd>{{ clientForm.controls.taxId.value || emptyValueLabel }}</dd></div>
              <div><dt i18n="@@emailLabel">Email</dt><dd>{{ clientForm.controls.email.value || emptyValueLabel }}</dd></div>
              <div><dt i18n="@@phoneLabel">Teléfono</dt><dd>{{ clientForm.controls.phone.value || emptyValueLabel }}</dd></div>
              <div><dt i18n="@@locationLabel">Ubicación</dt><dd>{{ reviewLocation() }}</dd></div>
            </dl>
          </section>

          <p class="form-error" *ngIf="error()">{{ error() }}</p>

          <div class="row-actions wizard-actions">
            <button type="button" class="secondary" *ngIf="!clientId && currentStep() > 1" (click)="previousStep()" i18n="@@backButton">Volver</button>
            <button type="button" *ngIf="!clientId && currentStep() < 4" (click)="nextStep()" i18n="@@continueButton">Continuar</button>
            <button type="button" class="secondary" *ngIf="!clientId && currentStep() < 4 && basicDataValid()" [disabled]="loading()" (click)="saveBasic()" i18n="@@saveBasicClientButton">Guardar con datos básicos</button>
            <button type="submit" *ngIf="clientId || currentStep() === 4" [disabled]="loading()">
              {{ loading() ? savingLabel : saveLabel }}
            </button>
            <a class="secondary-link" [routerLink]="['/organizations', organizationId, 'clients']" i18n="@@cancelLink">Cancelar</a>
          </div>
        </form>
      </section>
    </main>
  `
})
export class ClientFormComponent implements OnInit, OnDestroy {
  readonly loading = signal(false);
  readonly error = signal("");
  readonly submitAttempted = signal(false);
  readonly currentStep = signal(1);
  readonly saveLabel = $localize`:@@saveButton:Guardar`;
  readonly savingLabel = $localize`:@@savingButton:Guardando...`;
  readonly companyLabel = $localize`:@@companyLabel:Empresa`;
  readonly naturalPersonLabel = $localize`:@@naturalPersonLabel:Persona natural`;
  readonly emptyValueLabel = $localize`:@@emptyValueLabel:Sin informar`;
  readonly clientProgressLabel = $localize`:@@clientProgressLabel:Progreso del cliente`;
  readonly wizardSteps = [
    { id: "identity", label: $localize`:@@clientStepIdentity:Tipo e identificación` },
    { id: "contact", label: $localize`:@@clientStepContact:Datos de contacto` },
    { id: "address", label: $localize`:@@clientStepAddress:Dirección` },
    { id: "review", label: $localize`:@@clientStepReview:Revisión` }
  ] as const;
  readonly fieldLabels = {
    type: $localize`:@@typeLabel:Tipo`,
    status: $localize`:@@statusLabel:Estado`,
    firstName: $localize`:@@firstNameLabel:Nombre`,
    lastName: $localize`:@@lastNameLabel:Apellido`,
    legalName: $localize`:@@legalNameLabel:Razón social`,
    taxId: $localize`:@@taxIdLabel:RUT o identificación tributaria`,
    email: $localize`:@@emailLabel:Email`,
    phone: $localize`:@@phoneLabel:Teléfono`,
    whatsapp: $localize`:@@whatsappLabel:WhatsApp`,
    country: $localize`:@@countryLabel:País`,
    region: $localize`:@@regionLabel:Región`,
    city: $localize`:@@cityOrCommuneLabel:Comuna o ciudad`,
    address: $localize`:@@addressLabel:Dirección`,
    notes: $localize`:@@notesLabel:Notas`
  };
  readonly fieldIds = {
    type: "client-form-type", status: "client-form-status", firstName: "client-form-firstName",
    lastName: "client-form-lastName", legalName: "client-form-legalName", taxId: "client-form-taxId",
    email: "client-form-email", phonePrefix: "client-phone-prefix", phone: "client-phone",
    whatsapp: "client-form-whatsapp", country: "client-form-country", region: "client-form-region",
    city: "client-form-city", address: "client-form-address", notes: "client-form-notes"
  };
  private readonly phoneCountry = signal("CL");
  readonly clientForm = new FormGroup({
    type: new FormControl<ClientType>("NATURAL_PERSON", { nonNullable: true, validators: [Validators.required] }),
    status: new FormControl<ClientStatus>("LEAD", { nonNullable: true, validators: [Validators.required] }),
    firstName: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(80)] }),
    lastName: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(80)] }),
    legalName: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(160)] }),
    taxId: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(40), chileanRutValidator()] }),
    email: new FormControl("", { nonNullable: true, validators: [emailValidator()] }),
    phone: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(40), internationalPhoneValidator({ country: () => this.phoneCountry() })] }),
    phonePrefix: new FormControl("+56", { nonNullable: true }),
    whatsapp: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(40), internationalPhoneValidator({ country: () => this.phoneCountry(), requireCountryCode: true })] }),
    country: new FormControl("CL", { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
    region: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(120)] }),
    city: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(120)] }),
    address: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(240)] }),
    notes: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(2000)] })
  });
  readonly wizardValidation = new WizardValidationState(this.clientForm, {
    steps: {
      1: ["type", "status", "firstName", "lastName", "legalName", "taxId"],
      2: ["email", "phonePrefix", "phone", "whatsapp"],
      3: ["country", "region", "city", "address", "notes"],
      4: ["type", "status", "firstName", "lastName", "legalName", "taxId", "email", "phonePrefix", "phone", "whatsapp", "country", "region", "city", "address", "notes"]
    },
    fieldIds: this.fieldIds
  });
  organizationId = "";
  clientId = "";
  readonly regions = CHILE_REGIONS.map((region) => region.name);
  private readonly citiesByRegion: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
    CHILE_REGIONS.map((region) => [region.name, region.communes])
  );
  private initialClientCreated = false;
  private wizardCompleted = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly clientsService: ClientsService,
    private readonly organizationService: OrganizationService,
    private readonly notifications: NotificationService,
    private readonly assistantService: AssistantService,
    private readonly analytics: ProductAnalyticsService,
    private readonly destroyRef: DestroyRef
  ) {}

  async ngOnInit(): Promise<void> {
    this.organizationId = this.route.snapshot.paramMap.get("organizationId") ?? "";
    this.clientId = this.route.snapshot.paramMap.get("clientId") ?? "";
    await this.organizationService.setActiveOrganization(this.organizationId);
    this.clientForm.controls.type.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyTypeValidators());
    this.clientForm.controls.country.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.phoneCountry.set(this.clientForm.controls.country.value);
      this.clientForm.controls.region.setValue("");
      this.clientForm.controls.city.setValue("");
      this.clientForm.controls.taxId.updateValueAndValidity();
      this.clientForm.controls.phone.updateValueAndValidity();
      this.clientForm.controls.whatsapp.updateValueAndValidity();
      this.applyTypeValidators();
    });
    this.applyTypeValidators();

    if (this.clientId) {
      await this.loadClient();
    } else {
      this.initialClientCreated = (await this.assistantService.activation(this.organizationId)).completedSteps.includes("first_client_created");
    }
  }

  ngOnDestroy(): void {
    if (!this.clientId && this.clientForm.dirty && !this.wizardCompleted) {
      this.analytics.track("wizard_abandoned", { flow: "client", step: String(this.currentStep()) });
    }
  }

  showError(controlName: keyof typeof this.clientForm.controls): boolean {
    const control = this.clientForm.controls[controlName];
    return control.invalid && (control.dirty || control.touched);
  }

  async save(): Promise<void> {
    this.submitAttempted.set(true);
    this.applyTypeValidators();
    if (this.wizardValidation.attemptAll().length > 0) {
      this.wizardValidation.focusFirst(4);
      return;
    }

    this.loading.set(true);
    this.error.set("");
    try {
      const payload = this.buildPayload();
      const client = this.clientId
        ? await this.clientsService.update(this.organizationId, this.clientId, payload)
        : await this.clientsService.create(this.organizationId, payload);
      this.notifications.success(
        this.clientId
          ? $localize`:@@clientUpdatedSuccess:Cliente actualizado correctamente.`
          : $localize`:@@clientCreatedSuccess:Cliente creado correctamente.`
      );
      if (!this.clientId) {
        this.wizardCompleted = true;
        this.analytics.track("wizard_completed", { flow: "client", step: "review" });
        if (!this.initialClientCreated) this.analytics.track("first_client_created", { flow: "client" });
      }
      await this.router.navigate(["/organizations", this.organizationId, "clients", client.id]);
    } catch (error) {
      this.notifications.fromError(error);
      this.error.set($localize`:@@clientSaveError:No fue posible guardar el cliente. Revisa los datos e intenta nuevamente.`);
    } finally {
      this.loading.set(false);
    }
  }

  formatRut(): void {
    const control = this.clientForm.controls.taxId;
    if (this.clientForm.controls.country.value.toUpperCase() === "CL" && control.value.trim()) {
      control.setValue(formatChileanRut(control.value));
      control.updateValueAndValidity();
    }
  }

  nextStep(): void {
    this.applyTypeValidators();
    const step = this.currentStep();
    if (this.wizardValidation.attempt(step).length > 0) {
      this.wizardValidation.focusFirst(step);
      return;
    }
    this.currentStep.update((step) => Math.min(4, step + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  previousStep(): void {
    this.currentStep.update((step) => Math.max(1, step - 1));
  }

  saveBasic(): void {
    this.applyTypeValidators();
    if (this.wizardValidation.attempt(1).length === 0) void this.save();
  }

  basicDataValid(): boolean {
    return this.identityControls().every((control) => control.valid);
  }

  reviewName(): string {
    const value = this.clientForm.getRawValue();
    return value.type === "LEGAL_ENTITY" ? value.legalName : `${value.firstName} ${value.lastName}`.trim();
  }

  reviewLocation(): string {
    const value = this.clientForm.getRawValue();
    return [value.address, value.city, value.region, value.country].filter(Boolean).join(", ") || this.emptyValueLabel;
  }

  private async loadClient(): Promise<void> {
    this.loading.set(true);
    this.error.set("");
    try {
      const client = await this.clientsService.get(this.organizationId, this.clientId);
      this.clientForm.setValue({
        type: client.type,
        status: client.status,
        firstName: client.firstName ?? "",
        lastName: client.lastName ?? "",
        legalName: client.legalName ?? "",
        taxId: client.taxId ?? "",
        email: client.email ?? "",
        phone: client.phone ?? "",
        phonePrefix: "+56",
        whatsapp: client.whatsapp ?? "",
        country: client.country,
        region: client.region ?? "",
        city: client.city ?? "",
        address: client.address ?? "",
        notes: client.notes ?? ""
      });
      this.phoneCountry.set(client.country);
      this.clientForm.controls.phone.updateValueAndValidity();
      this.clientForm.controls.whatsapp.updateValueAndValidity();
      this.applyTypeValidators();
    } catch {
      this.error.set($localize`:@@clientLoadError:No fue posible cargar el cliente.`);
    } finally {
      this.loading.set(false);
    }
  }

  private applyTypeValidators(): void {
    const firstName = this.clientForm.controls.firstName;
    const lastName = this.clientForm.controls.lastName;
    const legalName = this.clientForm.controls.legalName;

    if (this.clientForm.controls.type.value === "NATURAL_PERSON") {
      firstName.setValidators([Validators.required, trimmedRequired(), Validators.maxLength(80)]);
      lastName.setValidators([Validators.required, trimmedRequired(), Validators.maxLength(80)]);
      legalName.setValidators([Validators.maxLength(160)]);
    } else {
      firstName.setValidators([Validators.maxLength(80)]);
      lastName.setValidators([Validators.maxLength(80)]);
      legalName.setValidators([Validators.required, trimmedRequired(), Validators.maxLength(160)]);
    }

    const policy = this.currentPolicy();
    const taxId = this.clientForm.controls.taxId;
    taxId.setValidators([
      ...(policy.taxIdRequired ? [Validators.required] : []),
      Validators.maxLength(40),
      ...(policy.country === "CL" ? [chileanRutValidator()] : [])
    ]);
    const whatsapp = this.clientForm.controls.whatsapp;
    whatsapp.setValidators([
      ...(policy.whatsappRequired ? [Validators.required] : []),
      Validators.maxLength(40),
      internationalPhoneValidator({
        country: () => this.phoneCountry(),
        required: policy.whatsappRequired,
        requireCountryCode: true
      })
    ]);

    firstName.updateValueAndValidity({ emitEvent: false });
    lastName.updateValueAndValidity({ emitEvent: false });
    legalName.updateValueAndValidity({ emitEvent: false });
    taxId.updateValueAndValidity({ emitEvent: false });
    whatsapp.updateValueAndValidity({ emitEvent: false });
  }

  private identityControls() {
    return this.clientForm.controls.type.value === "NATURAL_PERSON"
      ? [this.clientForm.controls.type, this.clientForm.controls.status, this.clientForm.controls.firstName, this.clientForm.controls.lastName, this.clientForm.controls.taxId]
      : [this.clientForm.controls.type, this.clientForm.controls.status, this.clientForm.controls.legalName, this.clientForm.controls.taxId];
  }

  private buildPayload(): ClientPayload {
    const value = this.clientForm.getRawValue();
    return {
      type: value.type,
      status: value.status,
      firstName: this.optional(value.firstName),
      lastName: this.optional(value.lastName),
      legalName: this.optional(value.legalName),
      taxId: value.country.toUpperCase() === "CL" ? this.optional(normalizeChileanRut(value.taxId)) : this.optional(value.taxId),
      email: this.optional(normalizeEmail(value.email)),
      phone: this.phoneValue(value.phonePrefix, value.phone),
      whatsapp: this.optional(normalizePhone(value.whatsapp)),
      country: this.optional(value.country) ?? "CL",
      region: this.optional(value.region),
      city: this.optional(value.city),
      address: this.optional(value.address),
      notes: this.optional(value.notes)
    };
  }

  titleLabel(): string {
    return this.clientId ? $localize`:@@editClientTitle:Editar cliente` : $localize`:@@newClientTitle:Nuevo cliente`;
  }

  availableCities(): readonly string[] {
    return this.citiesByRegion[this.clientForm.controls.region.value] ?? [];
  }

  currentPolicy() {
    return countryBusinessPolicy(this.clientForm.controls.country.value);
  }

  private phoneValue(prefix: string, phone: string): string | undefined {
    const normalized = phone.trim();
    if (!normalized) {
      return undefined;
    }
    return normalized.startsWith("+") ? normalizePhone(normalized) : normalizePhone(`${prefix}${normalized}`);
  }

  wizardAttempted(): boolean {
    return this.submitAttempted() || this.wizardValidation.isAttempted(this.currentStep());
  }

  activeStepPaths(): readonly string[] {
    return this.clientId || this.submitAttempted()
      ? this.wizardValidation.scopePaths(4)
      : this.wizardValidation.scopePaths(this.currentStep());
  }

  private optional(value: string): string | undefined {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
}
