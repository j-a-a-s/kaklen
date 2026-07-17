import { CommonModule } from "@angular/common";
import { Component, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { OrganizationService } from "../organizations/organization.service";
import { chileanRutValidator, formatChileanRut, normalizeChileanRut } from "../shared/validators/chilean-rut.validator";
import { NotificationService } from "../shared/notifications/notification.service";
import { trimmedRequired } from "../shared/forms/form-validators";
import { FieldErrorComponent, FormControlA11yDirective, FormErrorSummaryComponent,   FormFieldComponent
} from "../shared/forms/form-feedback.components";
import { UiIconComponent } from "../shared/ui-icon.component";

interface OrganizationForm {
  name: FormControl<string>;
  legalName: FormControl<string>;
  taxId: FormControl<string>;
}

@Component({
  selector: "kaklen-organization-new",
  standalone: true,
  imports: [FormFieldComponent, CommonModule, ReactiveFormsModule, FieldErrorComponent, FormControlA11yDirective, FormErrorSummaryComponent, UiIconComponent],
  template: `
    <main class="dashboard-shell form-shell">
      <section class="dashboard-panel form-panel">
        <p class="eyebrow" i18n="@@newOrganizationEyebrow">Nueva organización</p>
        <h1 i18n="@@newOrganizationTitle">Crear organización</h1>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <kaklen-form-error-summary [form]="form" [attempted]="submitAttempted()" [labels]="fieldLabels" />
          <label kaklen-form-field label="Nombre" i18n-label="@@organizationNameLabel" controlId="organization-new-name" required="auto" invalid="auto">
            <input kaklenControl formControlName="name" maxlength="160" aria-describedby="organization-name-error" />
            <kaklen-field-error id="organization-name-error" [control]="form.controls.name" [attempted]="submitAttempted()" />
          </label>
          <label kaklen-form-field label="Razón social" i18n-label="@@legalNameLabel" controlId="organization-new-legalName" required="auto" invalid="auto">
            <input kaklenControl formControlName="legalName" maxlength="160" />
          </label>
          <label kaklen-form-field label="RUT o identificación tributaria" i18n-label="@@taxIdLabel" controlId="organization-new-taxId" required="auto" invalid="auto">
            <input kaklenControl formControlName="taxId" maxlength="40" (blur)="formatRut()" aria-describedby="organization-tax-id-error" />
            <kaklen-field-error id="organization-tax-id-error" [control]="form.controls.taxId" [attempted]="submitAttempted()" />
          </label>
          <p class="form-error" *ngIf="error()">{{ error() }}</p>
          <button type="submit" [disabled]="loading()">
            <kaklen-icon name="plus" /><span>{{ submitLabel() }}</span>
          </button>
        </form>
      </section>
    </main>
  `
})
export class OrganizationNewComponent {
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly submitAttempted = signal(false);
  readonly fieldLabels = { name: $localize`:@@organizationNameLabel:Nombre`, legalName: $localize`:@@legalNameLabel:Razón social`, taxId: $localize`:@@taxIdLabel:RUT o identificación tributaria` };
  readonly form = new FormGroup<OrganizationForm>({
    name: new FormControl("", { nonNullable: true, validators: [Validators.required, trimmedRequired(), Validators.maxLength(160)] }),
    legalName: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(160)] }),
    taxId: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(40), chileanRutValidator()] })
  });

  constructor(
    private readonly organizationService: OrganizationService,
    private readonly router: Router,
    private readonly notifications: NotificationService
  ) {}

  async submit(): Promise<void> {
    this.submitAttempted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      window.setTimeout(() => document.querySelector<HTMLElement>("form .ng-invalid")?.focus(), 0);
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    try {
      const value = this.form.getRawValue();
      const organization = await this.organizationService.create({ ...value, name: value.name.trim(), legalName: value.legalName.trim() || undefined, taxId: normalizeChileanRut(value.taxId) || undefined });
      await this.organizationService.setActiveOrganization(organization.id);
      this.notifications.success($localize`:@@organizationCreatedSuccess:Organización creada correctamente.`);
      await this.router.navigate(["/organizations", organization.id, "members"]);
    } catch (error) {
      this.notifications.fromError(error);
      this.error.set($localize`:@@organizationCreateError:No pudimos crear la organización.`);
    } finally {
      this.loading.set(false);
    }
  }

  formatRut(): void {
    const control = this.form.controls.taxId;
    if (control.value.trim()) {
      control.setValue(formatChileanRut(control.value));
      control.updateValueAndValidity();
    }
  }

  submitLabel(): string {
    return this.loading() ? $localize`:@@creatingLabel:Creando...` : $localize`:@@createLabel:Crear`;
  }
}
