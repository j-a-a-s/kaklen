import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { ClientStatus, ClientType } from "../clients/client.models";
import { ClientPayload, ClientsService } from "../clients/clients.service";
import { OrganizationService } from "../organizations/organization.service";
import { chileanRutValidator, formatChileanRut, normalizeChileanRut } from "../shared/validators/chilean-rut.validator";
import { NotificationService } from "../shared/notifications/notification.service";

@Component({
  selector: "kaklen-client-form",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header">
        <div>
          <p class="eyebrow" i18n="@@crmEyebrow">CRM</p>
          <h1>{{ titleLabel() }}</h1>
        </div>
        <a [routerLink]="['/organizations', organizationId, 'clients']" i18n="@@backLink">Volver</a>
      </section>

      <section class="dashboard-panel">
        <form [formGroup]="clientForm" (ngSubmit)="save()">
          <div class="form-error-summary" *ngIf="submitAttempted() && clientForm.invalid" role="alert" tabindex="-1">
            <strong i18n="@@formErrorSummaryTitle">Revisa los campos marcados antes de continuar.</strong>
            <span i18n="@@formErrorSummaryHelp">Los mensajes bajo cada campo indican qué debes corregir.</span>
          </div>

          <fieldset class="form-section">
            <legend i18n="@@mainInformationSection">Información principal</legend>
            <div class="field-grid">
              <label>
                <span><span i18n="@@typeLabel">Tipo</span> <small class="required-label" i18n="@@requiredLabel">Obligatorio</small></span>
                <select formControlName="type">
                  <option value="NATURAL_PERSON" i18n="@@naturalPersonOption">Persona natural</option>
                  <option value="LEGAL_ENTITY" i18n="@@companyOption">Empresa</option>
                </select>
              </label>
              <label>
                <span><span i18n="@@statusLabel">Estado</span> <small class="required-label" i18n="@@requiredLabel">Obligatorio</small></span>
                <select formControlName="status">
                  <option value="LEAD" i18n="@@leadOption">Lead</option>
                  <option value="ACTIVE" i18n="@@activeOption">Activo</option>
                  <option value="INACTIVE" i18n="@@inactiveOption">Inactivo</option>
                </select>
              </label>
            </div>
            <div class="field-grid" *ngIf="clientForm.controls.type.value === 'NATURAL_PERSON'">
              <label>
                <span><span i18n="@@firstNameLabel">Nombre</span> <small class="required-label" i18n="@@requiredLabel">Obligatorio</small></span>
                <input formControlName="firstName" maxlength="80" placeholder="Ej. Camila" i18n-placeholder="@@firstNameExample" />
                <small class="field-error" *ngIf="showError('firstName')" i18n="@@firstNameValidation">El nombre es obligatorio.</small>
              </label>
              <label>
                <span><span i18n="@@lastNameLabel">Apellido</span> <small class="required-label" i18n="@@requiredLabel">Obligatorio</small></span>
                <input formControlName="lastName" maxlength="80" placeholder="Ej. Soto" i18n-placeholder="@@lastNameExample" />
                <small class="field-error" *ngIf="showError('lastName')" i18n="@@lastNameValidation">El apellido es obligatorio.</small>
              </label>
            </div>
            <label *ngIf="clientForm.controls.type.value === 'LEGAL_ENTITY'">
              <span><span i18n="@@legalNameLabel">Razón social</span> <small class="required-label" i18n="@@requiredLabel">Obligatorio</small></span>
              <input formControlName="legalName" maxlength="160" placeholder="Ej. Comercial Andes SpA" i18n-placeholder="@@legalNameExample" />
              <small class="field-error" *ngIf="showError('legalName')" i18n="@@legalNameRequired">La razón social es obligatoria.</small>
            </label>
            <label>
              <span><span i18n="@@taxIdLabel">RUT o identificación tributaria</span> <small i18n="@@optionalLabel">Opcional</small></span>
              <input formControlName="taxId" maxlength="40" (input)="formatRut()" placeholder="12.345.678-5" />
              <small i18n="@@rutFormatHelp">Formato esperado: 12.345.678-5.</small>
              <small class="field-error" *ngIf="clientForm.controls.taxId.hasError('chileanRut')" i18n="@@rutValidation">Ingresa un RUT válido.</small>
            </label>
          </fieldset>

          <fieldset class="form-section">
            <legend i18n="@@contactSection">Contacto</legend>
            <div class="field-grid">
              <label>
                <span><span i18n="@@emailLabel">Email</span> <small i18n="@@optionalLabel">Opcional</small></span>
                <input type="email" formControlName="email" placeholder="nombre@empresa.cl" />
                <small class="field-error" *ngIf="showError('email')" i18n="@@emailValidation">Ingresa un email válido.</small>
              </label>
              <label>
                <span><span i18n="@@phoneLabel">Teléfono</span> <small i18n="@@optionalLabel">Opcional</small></span>
                <span class="phone-control"><select formControlName="phonePrefix" aria-label="Prefijo telefónico" i18n-aria-label="@@phonePrefixLabel"><option value="+56">+56</option><option value="+54">+54</option><option value="+55">+55</option><option value="+1">+1</option></select><input type="tel" formControlName="phone" maxlength="40" placeholder="9 1234 5678" /></span>
              </label>
              <label>
                <span><span i18n="@@whatsappLabel">WhatsApp</span> <small i18n="@@optionalLabel">Opcional</small></span>
                <input type="tel" formControlName="whatsapp" maxlength="40" placeholder="+56 9 1234 5678" />
              </label>
            </div>
          </fieldset>

          <fieldset class="form-section">
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
                <span><span i18n="@@cityLabel">Comuna o ciudad</span> <small i18n="@@optionalLabel">Opcional</small></span>
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

          <fieldset class="form-section">
            <legend i18n="@@additionalInformationSection">Información adicional</legend>
            <label>
              <span><span i18n="@@notesLabel">Notas</span> <small i18n="@@optionalLabel">Opcional</small></span>
              <textarea formControlName="notes" maxlength="2000" i18n-placeholder="@@clientNotesPlaceholder" placeholder="Preferencias, contexto comercial o información relevante"></textarea>
            </label>
          </fieldset>

          <p class="form-error" *ngIf="error()">{{ error() }}</p>

          <div class="row-actions">
            <button type="submit" [disabled]="loading()">
              {{ loading() ? savingLabel : saveLabel }}
            </button>
            <a class="secondary-link" [routerLink]="['/organizations', organizationId, 'clients']" i18n="@@cancelLink">Cancelar</a>
          </div>
        </form>
      </section>
    </main>
  `
})
export class ClientFormComponent implements OnInit {
  readonly loading = signal(false);
  readonly error = signal("");
  readonly submitAttempted = signal(false);
  readonly saveLabel = $localize`:@@saveButton:Guardar`;
  readonly savingLabel = $localize`:@@savingButton:Guardando...`;
  readonly clientForm = new FormGroup({
    type: new FormControl<ClientType>("NATURAL_PERSON", { nonNullable: true }),
    status: new FormControl<ClientStatus>("LEAD", { nonNullable: true }),
    firstName: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(80)] }),
    lastName: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(80)] }),
    legalName: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(160)] }),
    taxId: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(40), chileanRutValidator()] }),
    email: new FormControl("", { nonNullable: true, validators: [Validators.email] }),
    phone: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(40)] }),
    phonePrefix: new FormControl("+56", { nonNullable: true }),
    whatsapp: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(40)] }),
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

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly clientsService: ClientsService,
    private readonly organizationService: OrganizationService,
    private readonly notifications: NotificationService
  ) {}

  async ngOnInit(): Promise<void> {
    this.organizationId = this.route.snapshot.paramMap.get("organizationId") ?? "";
    this.clientId = this.route.snapshot.paramMap.get("clientId") ?? "";
    await this.organizationService.setActiveOrganization(this.organizationId);
    this.clientForm.controls.type.valueChanges.subscribe(() => this.applyTypeValidators());
    this.clientForm.controls.country.valueChanges.subscribe(() => {
      this.clientForm.controls.taxId.updateValueAndValidity();
    });
    this.applyTypeValidators();

    if (this.clientId) {
      await this.loadClient();
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
      firstName.setValidators([Validators.required, Validators.maxLength(80)]);
      lastName.setValidators([Validators.required, Validators.maxLength(80)]);
      legalName.setValidators([Validators.maxLength(160)]);
    } else {
      firstName.setValidators([Validators.maxLength(80)]);
      lastName.setValidators([Validators.maxLength(80)]);
      legalName.setValidators([Validators.required, Validators.maxLength(160)]);
    }

    firstName.updateValueAndValidity({ emitEvent: false });
    lastName.updateValueAndValidity({ emitEvent: false });
    legalName.updateValueAndValidity({ emitEvent: false });
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
      email: this.optional(value.email),
      phone: this.phoneValue(value.phonePrefix, value.phone),
      whatsapp: this.optional(value.whatsapp),
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
    return normalized.startsWith("+") ? normalized : `${prefix} ${normalized}`;
  }

  private optional(value: string): string | undefined {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
}
