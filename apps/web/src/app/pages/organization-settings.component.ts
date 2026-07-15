import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { OrganizationService } from "../organizations/organization.service";
import { chileanRutValidator, formatChileanRut, normalizeChileanRut } from "../shared/validators/chilean-rut.validator";
import { NotificationService } from "../shared/notifications/notification.service";

@Component({
  selector: "kaklen-organization-settings",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <main class="dashboard-shell form-shell">
      <section class="dashboard-panel form-panel">
        <p class="eyebrow" i18n="@@settingsEyebrow">Ajustes</p>
        <h1 i18n="@@organizationSettingsTitle">Organización</h1>
        <form [formGroup]="form" (ngSubmit)="save()">
          <label>
            <span i18n="@@organizationNameLabel">Nombre</span>
            <input formControlName="name" />
          </label>
          <label>
            <span i18n="@@legalNameLabel">Razón social</span>
            <input formControlName="legalName" />
          </label>
          <label>
            <span i18n="@@taxIdLabel">RUT o tax ID</span>
            <input formControlName="taxId" (blur)="formatRut()" />
            <small *ngIf="form.controls.taxId.hasError('chileanRut')" i18n="@@rutValidation">Ingresa un RUT válido.</small>
          </label>
          <label>
            <span i18n="@@countryLabel">País</span>
            <input formControlName="country" maxlength="2" />
          </label>
          <label>
            <span i18n="@@currencyLabel">Moneda</span>
            <input formControlName="currency" maxlength="3" />
          </label>
          <label>
            <span i18n="@@timezoneLabel">Zona horaria</span>
            <input formControlName="timezone" />
          </label>
          <label>
            <span i18n="@@dateFormatLabel">Formato de fecha</span>
            <select formControlName="dateFormat">
              <option value="dd-MM-yyyy">dd-MM-yyyy</option>
              <option value="MM/dd/yyyy">MM/dd/yyyy</option>
              <option value="dd/MM/yyyy">dd/MM/yyyy</option>
              <option value="yyyy-MM-dd">yyyy-MM-dd</option>
            </select>
          </label>
          <label>
            <span i18n="@@numberFormatLabel">Formato numérico</span>
            <select formControlName="numberFormat">
              <option value="es">1.234.567,89</option>
              <option value="en-US">1,234,567.89</option>
              <option value="pt-BR">1.234.567,89</option>
            </select>
          </label>
          <p class="form-error" *ngIf="message()">{{ message() }}</p>
          <button type="submit" [disabled]="form.invalid || loading()" i18n="@@saveButton">Guardar</button>
        </form>
      </section>
    </main>
  `
})
export class OrganizationSettingsComponent implements OnInit {
  readonly loading = signal(false);
  readonly message = signal<string | null>(null);
  readonly form = new FormGroup({
    name: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    legalName: new FormControl("", { nonNullable: true }),
    taxId: new FormControl("", { nonNullable: true, validators: [chileanRutValidator()] }),
    country: new FormControl("CL", { nonNullable: true, validators: [Validators.required] }),
    currency: new FormControl("CLP", { nonNullable: true, validators: [Validators.required] }),
    timezone: new FormControl("America/Santiago", { nonNullable: true, validators: [Validators.required] }),
    dateFormat: new FormControl("dd-MM-yyyy", { nonNullable: true, validators: [Validators.required] }),
    numberFormat: new FormControl("es", { nonNullable: true, validators: [Validators.required] })
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
      country: organization.country,
      currency: organization.currency,
      timezone: organization.timezone,
      dateFormat: organization.dateFormat,
      numberFormat: organization.numberFormat
    });
  }

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    this.loading.set(true);
    this.message.set(null);
    try {
      const value = this.form.getRawValue();
      await this.organizationService.update(this.organizationId, {
        ...value,
        taxId: normalizeChileanRut(value.taxId) || null
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
