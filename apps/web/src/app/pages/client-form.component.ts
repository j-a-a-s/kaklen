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
  FormErrorSummaryComponent,
  OptionalFieldLabelComponent,
  RequiredFieldIndicatorComponent
} from "../shared/forms/form-feedback.components";
import { UiIconComponent } from "../shared/ui-icon.component";

@Component({
  selector: "kaklen-client-form",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, FieldErrorComponent, FormErrorSummaryComponent, OptionalFieldLabelComponent, RequiredFieldIndicatorComponent, UiIconComponent],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header">
        <div>
          <p class="eyebrow" i18n="@@crmEyebrow">CRM</p>
          <h1>{{ titleLabel() }}</h1>
        </div>
        <a class="ghost button-link" [routerLink]="['/organizations', organizationId, 'clients']"><kaklen-icon name="arrow-left" /><span i18n="@@backLink">Volver</span></a>
      </section>

      <section class="dashboard-panel">
        <form [formGroup]="clientForm" (ngSubmit)="save()">
          <ol *ngIf="!clientId" class="wizard-steps client-wizard-steps" aria-label="Progreso del cliente" i18n-aria-label="@@clientProgressLabel">
            <li [class.active]="currentStep() === 1" [class.complete]="currentStep() > 1" [attr.aria-current]="currentStep() === 1 ? 'step' : null"><span>1</span><strong i18n="@@clientStepIdentity">Tipo e identificación</strong></li>
            <li [class.active]="currentStep() === 2" [class.complete]="currentStep() > 2" [attr.aria-current]="currentStep() === 2 ? 'step' : null"><span>2</span><strong i18n="@@clientStepContact">Datos de contacto</strong></li>
            <li [class.active]="currentStep() === 3" [class.complete]="currentStep() > 3" [attr.aria-current]="currentStep() === 3 ? 'step' : null"><span>3</span><strong i18n="@@clientStepAddress">Dirección</strong></li>
            <li [class.active]="currentStep() === 4" [attr.aria-current]="currentStep() === 4 ? 'step' : null"><span>4</span><strong i18n="@@clientStepReview">Revisión</strong></li>
          </ol>
          <kaklen-form-error-summary [form]="clientForm" [submitted]="submitAttempted()" [labels]="fieldLabels" />

          <fieldset class="form-section wizard-stage" *ngIf="clientId || currentStep() === 1">
            <legend i18n="@@mainInformationSection">Información principal</legend>
            <div class="field-grid">
              <label>
                <span><span i18n="@@typeLabel">Tipo</span><kaklen-required /></span>
                <select formControlName="type">
                  <option value="NATURAL_PERSON" i18n="@@naturalPersonOption">Persona natural</option>
                  <option value="LEGAL_ENTITY" i18n="@@companyOption">Empresa</option>
                </select>
              </label>
              <label>
                <span><span i18n="@@statusLabel">Estado</span><kaklen-required /></span>
                <select formControlName="status">
                  <option value="LEAD" i18n="@@leadOption">Lead</option>
                  <option value="ACTIVE" i18n="@@activeOption">Activo</option>
                  <option value="INACTIVE" i18n="@@inactiveOption">Inactivo</option>
                </select>
              </label>
            </div>
            <div class="field-grid" *ngIf="clientForm.controls.type.value === 'NATURAL_PERSON'">
              <label>
                <span><span i18n="@@firstNameLabel">Nombre</span><kaklen-required /></span>
                <input formControlName="firstName" maxlength="80" placeholder="Ej. Camila" i18n-placeholder="@@firstNameExample" aria-describedby="client-first-name-error" />
                <kaklen-field-error id="client-first-name-error" [control]="clientForm.controls.firstName" [submitted]="submitAttempted()" />
              </label>
              <label>
                <span><span i18n="@@lastNameLabel">Apellido</span><kaklen-required /></span>
                <input formControlName="lastName" maxlength="80" placeholder="Ej. Soto" i18n-placeholder="@@lastNameExample" aria-describedby="client-last-name-error" />
                <kaklen-field-error id="client-last-name-error" [control]="clientForm.controls.lastName" [submitted]="submitAttempted()" />
              </label>
            </div>
            <label *ngIf="clientForm.controls.type.value === 'LEGAL_ENTITY'">
              <span><span i18n="@@legalNameLabel">Razón social</span><kaklen-required /></span>
              <input formControlName="legalName" maxlength="160" placeholder="Ej. Comercial Andes SpA" i18n-placeholder="@@legalNameExample" aria-describedby="client-legal-name-error" />
              <kaklen-field-error id="client-legal-name-error" [control]="clientForm.controls.legalName" [submitted]="submitAttempted()" />
            </label>
            <label>
              <span><span i18n="@@taxIdLabel">RUT o identificación tributaria</span><kaklen-optional *ngIf="clientForm.controls.type.value !== 'LEGAL_ENTITY'" /><kaklen-required *ngIf="clientForm.controls.type.value === 'LEGAL_ENTITY'" /></span>
              <input formControlName="taxId" maxlength="40" (input)="formatRut()" placeholder="12.345.678-5" aria-describedby="client-tax-id-help client-tax-id-error" />
              <small id="client-tax-id-help" i18n="@@rutFormatHelp">Formato esperado: 12.345.678-5.</small>
              <kaklen-field-error id="client-tax-id-error" [control]="clientForm.controls.taxId" [submitted]="submitAttempted()" />
            </label>
          </fieldset>

          <fieldset class="form-section wizard-stage" *ngIf="clientId || currentStep() === 2">
            <legend i18n="@@contactSection">Contacto</legend>
            <div class="field-grid">
              <label>
                <span><span i18n="@@emailLabel">Email</span><kaklen-optional /></span>
                <input type="email" formControlName="email" maxlength="254" inputmode="email" placeholder="nombre@empresa.cl" aria-describedby="client-email-error" />
                <kaklen-field-error id="client-email-error" [control]="clientForm.controls.email" [submitted]="submitAttempted()" />
              </label>
              <div class="compound-form-field">
                <label for="client-phone"><span><span i18n="@@phoneLabel">Teléfono</span><kaklen-optional /></span></label>
                <span class="phone-control"><select formControlName="phonePrefix" aria-label="Prefijo telefónico" i18n-aria-label="@@phonePrefixLabel"><option value="+56">+56</option><option value="+54">+54</option><option value="+55">+55</option><option value="+1">+1</option></select><input id="client-phone" type="tel" inputmode="tel" formControlName="phone" maxlength="40" placeholder="9 1234 5678" aria-describedby="client-phone-error" /></span>
                <kaklen-field-error id="client-phone-error" [control]="clientForm.controls.phone" [submitted]="submitAttempted()" />
              </div>
              <label>
                <span><span i18n="@@whatsappLabel">WhatsApp</span><kaklen-optional /></span>
                <input type="tel" inputmode="tel" formControlName="whatsapp" maxlength="40" placeholder="+56 9 1234 5678" aria-describedby="client-whatsapp-error" />
                <kaklen-field-error id="client-whatsapp-error" [control]="clientForm.controls.whatsapp" [submitted]="submitAttempted()" />
              </label>
            </div>
          </fieldset>

          <fieldset class="form-section wizard-stage" *ngIf="clientId || currentStep() === 3">
            <legend i18n="@@addressSection">Dirección</legend>
            <div class="field-grid">
              <label>
                <span i18n="@@countryLabel">País</span>
                <select formControlName="country">
                  <option value="CL" i18n="@@countryChileLabel">Chile</option>
                  <option value="AR" i18n="@@countryArgentinaLabel">Argentina</option>
                  <option value="BR" i18n="@@countryBrazilLabel">Brasil</option>
                  <option value="MX" i18n="@@countryMexicoLabel">México</option>
                  <option value="US" i18n="@@countryUnitedStatesLabel">Estados Unidos</option>
                </select>
              </label>
              <label>
                <span><span i18n="@@regionLabel">Región</span> <small i18n="@@optionalLabel">Opcional</small></span>
                <select formControlName="region">
                  <option value="" i18n="@@selectRegionOption">Selecciona una región</option>
                  <option *ngFor="let region of regions" [value]="region">{{ region }}</option>
                </select>
              </label>
              <label>
                <span><span i18n="@@cityOrCommuneLabel">Comuna o ciudad</span> <small i18n="@@optionalLabel">Opcional</small></span>
                <select formControlName="city">
                  <option value="" i18n="@@selectCityOption">Selecciona una comuna o ciudad</option>
                  <option *ngFor="let city of availableCities()" [value]="city">{{ city }}</option>
                </select>
              </label>
              <label>
                <span><span i18n="@@addressLabel">Dirección</span> <small i18n="@@optionalLabel">Opcional</small></span>
                <input formControlName="address" maxlength="240" placeholder="Calle, número, oficina" i18n-placeholder="@@addressExample" />
              </label>
            </div>
          </fieldset>

          <fieldset class="form-section wizard-stage" *ngIf="clientId || currentStep() === 3">
            <legend i18n="@@additionalInformationSection">Información adicional</legend>
            <label>
              <span><span i18n="@@notesLabel">Notas</span> <small i18n="@@optionalLabel">Opcional</small></span>
              <textarea formControlName="notes" maxlength="2000" i18n-placeholder="@@clientNotesPlaceholder" placeholder="Preferencias, contexto comercial o información relevante"></textarea>
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

          <p class="form-error" *ngIf="stepError()">{{ stepError() }}</p>
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
  readonly stepError = signal("");
  readonly saveLabel = $localize`:@@saveButton:Guardar`;
  readonly savingLabel = $localize`:@@savingButton:Guardando...`;
  readonly companyLabel = $localize`:@@companyLabel:Empresa`;
  readonly naturalPersonLabel = $localize`:@@naturalPersonLabel:Persona natural`;
  readonly emptyValueLabel = $localize`:@@emptyValueLabel:Sin informar`;
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
  private readonly phoneCountry = signal("CL");
  readonly clientForm = new FormGroup({
    type: new FormControl<ClientType>("NATURAL_PERSON", { nonNullable: true }),
    status: new FormControl<ClientStatus>("LEAD", { nonNullable: true }),
    firstName: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(80)] }),
    lastName: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(80)] }),
    legalName: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(160)] }),
    taxId: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(40), chileanRutValidator()] }),
    email: new FormControl("", { nonNullable: true, validators: [emailValidator()] }),
    phone: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(40), internationalPhoneValidator({ country: () => this.phoneCountry() })] }),
    phonePrefix: new FormControl("+56", { nonNullable: true }),
    whatsapp: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(40), internationalPhoneValidator({ country: () => this.phoneCountry() })] }),
    country: new FormControl("CL", { nonNullable: true, validators: [Validators.maxLength(80)] }),
    region: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(120)] }),
    city: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(120)] }),
    address: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(240)] }),
    notes: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(2000)] })
  });
  organizationId = "";
  clientId = "";
  readonly regions = [
    "Arica y Parinacota", "Tarapacá", "Antofagasta", "Atacama", "Coquimbo", "Valparaíso",
    "Metropolitana de Santiago", "O'Higgins", "Maule", "Ñuble", "Biobío", "La Araucanía",
    "Los Ríos", "Los Lagos", "Aysén", "Magallanes"
  ];
  private readonly citiesByRegion: Readonly<Record<string, readonly string[]>> = {
    "Metropolitana de Santiago": ["Santiago", "Las Condes", "Providencia", "Ñuñoa", "Maipú", "Puente Alto"],
    Valparaíso: ["Valparaíso", "Viña del Mar", "Quilpué", "Concón"],
    Biobío: ["Concepción", "Talcahuano", "San Pedro de la Paz", "Los Ángeles"]
  };
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
    this.clientForm.markAllAsTouched();
    if (this.clientForm.invalid) {
      this.focusFirstInvalid();
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
    if (!this.validateStep(this.currentStep())) {
      this.stepError.set(this.stepValidationMessage(this.currentStep()));
      this.focusFirstInvalid();
      return;
    }
    this.stepError.set("");
    this.currentStep.update((step) => Math.min(4, step + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  previousStep(): void {
    this.stepError.set("");
    this.currentStep.update((step) => Math.max(1, step - 1));
  }

  saveBasic(): void {
    if (this.validateStep(1)) void this.save();
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

    const taxId = this.clientForm.controls.taxId;
    taxId.setValidators([
      ...(this.clientForm.controls.type.value === "LEGAL_ENTITY" && this.clientForm.controls.country.value.toUpperCase() === "CL" ? [Validators.required] : []),
      Validators.maxLength(40),
      chileanRutValidator()
    ]);

    firstName.updateValueAndValidity({ emitEvent: false });
    lastName.updateValueAndValidity({ emitEvent: false });
    legalName.updateValueAndValidity({ emitEvent: false });
    taxId.updateValueAndValidity({ emitEvent: false });
  }

  private validateStep(step: number): boolean {
    const controls = step === 1
      ? this.identityControls()
      : step === 2
        ? [this.clientForm.controls.email, this.clientForm.controls.phone, this.clientForm.controls.whatsapp]
        : step === 3
          ? [this.clientForm.controls.country, this.clientForm.controls.region, this.clientForm.controls.city, this.clientForm.controls.address, this.clientForm.controls.notes]
          : Object.values(this.clientForm.controls);
    controls.forEach((control) => control.markAsTouched());
    return controls.every((control) => control.valid);
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

  private phoneValue(prefix: string, phone: string): string | undefined {
    const normalized = phone.trim();
    if (!normalized) {
      return undefined;
    }
    return normalized.startsWith("+") ? normalizePhone(normalized) : normalizePhone(`${prefix}${normalized}`);
  }

  private stepValidationMessage(step: number): string {
    const controls = step === 1
      ? this.identityControls()
      : step === 2
        ? [this.clientForm.controls.email, this.clientForm.controls.phone, this.clientForm.controls.whatsapp]
        : [this.clientForm.controls.country, this.clientForm.controls.region, this.clientForm.controls.city, this.clientForm.controls.address, this.clientForm.controls.notes];
    const invalidCount = controls.filter((control) => control.invalid).length;
    return invalidCount === 1
      ? $localize`:@@clientStepSingleValidationError:Falta completar o corregir 1 campo de esta etapa.`
      : $localize`:@@clientStepValidationError:Falta completar o corregir ${invalidCount}:fieldCount: campos de esta etapa.`;
  }

  private focusFirstInvalid(): void {
    window.setTimeout(() => {
      document.querySelector<HTMLElement>(".wizard-stage input.ng-invalid, .wizard-stage select.ng-invalid, .wizard-stage textarea.ng-invalid")?.focus();
    }, 0);
  }

  private optional(value: string): string | undefined {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
}
