import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { OrganizationService } from "../organizations/organization.service";
import { chileanRutValidator, formatChileanRut, normalizeChileanRut } from "../shared/validators/chilean-rut.validator";
import { NotificationService } from "../shared/notifications/notification.service";
import { internationalPhoneValidator, normalizePhone, trimmedRequired } from "../shared/forms/form-validators";
import { FieldErrorComponent, FormControlA11yDirective, FormErrorSummaryComponent,   FormFieldComponent
} from "../shared/forms/form-feedback.components";
import { UiIconComponent } from "../shared/ui-icon.component";

@Component({
  selector: "kaklen-organization-settings",
  standalone: true,
  imports: [FormFieldComponent, CommonModule, ReactiveFormsModule, FieldErrorComponent, FormControlA11yDirective, FormErrorSummaryComponent, UiIconComponent],
  template: `
    <main class="dashboard-shell form-shell">
      <section class="dashboard-panel form-panel">
        <p class="eyebrow" i18n="@@settingsEyebrow">Ajustes</p>
        <h1 i18n="@@organizationSettingsTitle">Organización</h1>
        <form [formGroup]="form" (ngSubmit)="save()">
          <kaklen-form-error-summary [form]="form" [attempted]="submitAttempted()" [labels]="fieldLabels" />
          <label kaklen-form-field label="Nombre" i18n-label="@@organizationNameLabel" controlId="organization-settings-name" required="auto" invalid="auto">
            <input kaklenControl formControlName="name" maxlength="160" aria-describedby="settings-name-error" />
            <kaklen-field-error id="settings-name-error" [control]="form.controls.name" [attempted]="submitAttempted()" />
          </label>
          <label kaklen-form-field label="Razón social" i18n-label="@@legalNameLabel" controlId="organization-settings-legalName" required="auto" invalid="auto">
            <input kaklenControl formControlName="legalName" maxlength="160" />
          </label>
          <label kaklen-form-field label="RUT o identificación tributaria" i18n-label="@@taxIdLabel" controlId="organization-settings-taxId" required="auto" invalid="auto">
            <input kaklenControl formControlName="taxId" maxlength="40" (blur)="formatRut()" aria-describedby="settings-tax-id-error" />
            <kaklen-field-error id="settings-tax-id-error" [control]="form.controls.taxId" [attempted]="submitAttempted()" />
          </label>
          <label kaklen-form-field label="Dirección" i18n-label="@@addressLabel" controlId="organization-settings-address" required="auto" invalid="auto">
            <input kaklenControl formControlName="address" maxlength="500" />
          </label>
          <label kaklen-form-field label="Teléfono" i18n-label="@@phoneLabel" controlId="organization-settings-phone" required="auto" invalid="auto">
            <input kaklenControl type="tel" inputmode="tel" formControlName="phone" maxlength="24" aria-describedby="settings-phone-error" />
            <kaklen-field-error id="settings-phone-error" [control]="form.controls.phone" [attempted]="submitAttempted()" />
          </label>
          <label kaklen-form-field label="WhatsApp" i18n-label="@@whatsappLabel" controlId="organization-settings-whatsapp" required="auto" invalid="auto">
            <input kaklenControl type="tel" inputmode="tel" formControlName="whatsapp" maxlength="24" aria-describedby="settings-whatsapp-error" />
            <kaklen-field-error id="settings-whatsapp-error" [control]="form.controls.whatsapp" [attempted]="submitAttempted()" />
          </label>
          <label kaklen-form-field label="País" i18n-label="@@countryLabel" controlId="organization-settings-country" required="auto" invalid="auto">
            <select kaklenControl formControlName="country">
              <option value="CL" i18n="@@countryChileLabel">Chile</option>
              <option value="AR" i18n="@@countryArgentinaLabel">Argentina</option>
              <option value="BR" i18n="@@countryBrazilLabel">Brasil</option>
              <option value="MX" i18n="@@countryMexicoLabel">México</option>
              <option value="US" i18n="@@countryUnitedStatesLabel">Estados Unidos</option>
            </select>
          </label>
          <label kaklen-form-field label="Moneda" i18n-label="@@currencyLabel" controlId="organization-settings-currency" required="auto" invalid="auto">
            <select kaklenControl formControlName="currency">
              <option value="CLP" i18n="@@currencyClpLabel">Peso chileno (CLP)</option>
              <option value="USD" i18n="@@currencyUsdLabel">Dólar estadounidense (USD)</option>
              <option value="BRL" i18n="@@currencyBrlLabel">Real brasileño (BRL)</option>
              <option value="EUR" i18n="@@currencyEurLabel">Euro (EUR)</option>
            </select>
          </label>
          <label kaklen-form-field label="Zona horaria" i18n-label="@@timezoneLabel" controlId="organization-settings-timezone" required="auto" invalid="auto">
            <select kaklenControl formControlName="timezone">
              <option value="America/Santiago" i18n="@@timezoneSantiagoLabel">Santiago, Chile</option>
              <option value="America/Sao_Paulo" i18n="@@timezoneSaoPauloLabel">São Paulo, Brasil</option>
              <option value="America/New_York" i18n="@@timezoneNewYorkLabel">Nueva York, Estados Unidos</option>
              <option value="UTC" i18n="@@timezoneUtcLabel">Tiempo universal (UTC)</option>
            </select>
          </label>
          <label kaklen-form-field label="Formato de fecha" i18n-label="@@dateFormatLabel" controlId="organization-settings-dateFormat" required="auto" invalid="auto">
            <select kaklenControl formControlName="dateFormat">
              <option value="dd-MM-yyyy" i18n="@@dateFormatDayMonthYearDash">Día-mes-año (31-12-2026)</option>
              <option value="MM/dd/yyyy" i18n="@@dateFormatMonthDayYear">Mes/día/año (12/31/2026)</option>
              <option value="dd/MM/yyyy" i18n="@@dateFormatDayMonthYearSlash">Día/mes/año (31/12/2026)</option>
              <option value="yyyy-MM-dd" i18n="@@dateFormatYearMonthDay">Año-mes-día (2026-12-31)</option>
            </select>
          </label>
          <label kaklen-form-field label="Formato numérico" i18n-label="@@numberFormatLabel" controlId="organization-settings-numberFormat" required="auto" invalid="auto">
            <select kaklenControl formControlName="numberFormat">
              <option value="es" i18n="@@numberFormatSpanish">Chileno (1.234.567,89)</option>
              <option value="en-US" i18n="@@numberFormatEnglish">Inglés (1,234,567.89)</option>
              <option value="pt-BR" i18n="@@numberFormatPortuguese">Brasileño (1.234.567,89)</option>
            </select>
          </label>
          <label kaklen-form-field label="Idioma predeterminado" i18n-label="@@defaultLanguageLabel" controlId="organization-settings-defaultLocale" required="auto" invalid="auto">
            <select kaklenControl formControlName="defaultLocale">
              <option value="es" i18n="@@languageSpanish">Español</option>
              <option value="en" i18n="@@languageEnglish">English</option>
              <option value="pt-BR" i18n="@@languagePortuguese">Português</option>
            </select>
          </label>
          <p class="form-error" *ngIf="message()">{{ message() }}</p>
          <button type="submit" [disabled]="loading()"><kaklen-icon name="check" /><span i18n="@@saveButton">Guardar</span></button>
        </form>
      </section>
    </main>
  `
})
export class OrganizationSettingsComponent implements OnInit {
  readonly loading = signal(false);
  readonly message = signal<string | null>(null);
  readonly submitAttempted = signal(false);
  readonly fieldLabels = { name: $localize`:@@organizationNameLabel:Nombre`, legalName: $localize`:@@legalNameLabel:Razón social`, taxId: $localize`:@@taxIdLabel:RUT o identificación tributaria` };
  readonly form = new FormGroup({
    name: new FormControl("", { nonNullable: true, validators: [Validators.required, trimmedRequired(), Validators.maxLength(160)] }),
    legalName: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(160)] }),
    taxId: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(40), chileanRutValidator()] }),
    address: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(500)] }),
    phone: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(24), internationalPhoneValidator()] }),
    whatsapp: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(24), internationalPhoneValidator()] }),
    country: new FormControl("CL", { nonNullable: true, validators: [Validators.required] }),
    currency: new FormControl("CLP", { nonNullable: true, validators: [Validators.required] }),
    timezone: new FormControl("America/Santiago", { nonNullable: true, validators: [Validators.required] }),
    dateFormat: new FormControl("dd-MM-yyyy", { nonNullable: true, validators: [Validators.required] }),
    numberFormat: new FormControl("es", { nonNullable: true, validators: [Validators.required] }),
    defaultLocale: new FormControl("es", { nonNullable: true, validators: [Validators.required] })
  });
  private organizationId = "";

  constructor(
    private readonly route: ActivatedRoute,
    private readonly organizationService: OrganizationService,
    private readonly notifications: NotificationService
  ) {}

  async ngOnInit(): Promise<void> {
    this.organizationId = this.route.snapshot.paramMap.get("organizationId") ?? "";
    const organization = await this.organizationService.get(this.organizationId);
    this.form.setValue({
      name: organization.name,
      legalName: organization.legalName ?? "",
      taxId: organization.taxId ?? "",
      address: organization.address ?? "",
      phone: organization.phone ?? "",
      whatsapp: organization.whatsapp ?? "",
      country: organization.country,
      currency: organization.currency,
      timezone: organization.timezone,
      dateFormat: organization.dateFormat,
      numberFormat: organization.numberFormat,
      defaultLocale: organization.defaultLocale
    });
  }

  async save(): Promise<void> {
    this.submitAttempted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      window.setTimeout(() => document.querySelector<HTMLElement>("form .ng-invalid")?.focus(), 0);
      return;
    }

    this.loading.set(true);
    this.message.set(null);
    try {
      const value = this.form.getRawValue();
      await this.organizationService.update(this.organizationId, {
        ...value,
        name: value.name.trim(),
        legalName: value.legalName.trim() || null,
        taxId: normalizeChileanRut(value.taxId) || null,
        address: value.address.trim() || null,
        phone: normalizePhone(value.phone) || null,
        whatsapp: normalizePhone(value.whatsapp) || null
      });
      this.notifications.success($localize`:@@organizationUpdated:Organización actualizada.`);
      this.message.set($localize`:@@organizationUpdated:Organización actualizada.`);
    } catch (error) {
      this.notifications.fromError(error);
      this.message.set($localize`:@@organizationSaveError:No pudimos guardar los cambios.`);
    } finally {
      this.loading.set(false);
    }
  }

  formatRut(): void {
    const control = this.form.controls.taxId;
    if (this.form.controls.country.value.toUpperCase() === "CL" && control.value.trim()) {
      control.setValue(formatChileanRut(control.value));
      control.updateValueAndValidity();
    }
  }
}
