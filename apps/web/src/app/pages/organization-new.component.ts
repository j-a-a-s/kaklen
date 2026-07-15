import { CommonModule } from "@angular/common";
import { Component, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { OrganizationService } from "../organizations/organization.service";
import { chileanRutValidator, formatChileanRut, normalizeChileanRut } from "../shared/validators/chilean-rut.validator";
import { NotificationService } from "../shared/notifications/notification.service";

interface OrganizationForm {
  name: FormControl<string>;
  legalName: FormControl<string>;
  taxId: FormControl<string>;
}

@Component({
  selector: "kaklen-organization-new",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <main class="dashboard-shell form-shell">
      <section class="dashboard-panel form-panel">
        <p class="eyebrow" i18n="@@newOrganizationEyebrow">Nueva organización</p>
        <h1 i18n="@@newOrganizationTitle">Crear organización</h1>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <label>
            <span i18n="@@organizationNameLabel">Nombre</span>
            <input formControlName="name" />
          </label>
          <label>
            <span i18n="@@legalNameLabel">Razón social</span>
            <input formControlName="legalName" />
          </label>
          <label>
            <span i18n="@@taxIdLabel">RUT o identificación tributaria</span>
            <input formControlName="taxId" (blur)="formatRut()" />
            <small *ngIf="form.controls.taxId.hasError('chileanRut')" i18n="@@rutValidation">Ingresa un RUT válido.</small>
          </label>
          <p class="form-error" *ngIf="error()">{{ error() }}</p>
          <button type="submit" [disabled]="form.invalid || loading()">
            {{ submitLabel() }}
          </button>
        </form>
      </section>
    </main>
  `
})
export class OrganizationNewComponent {
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = new FormGroup<OrganizationForm>({
    name: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    legalName: new FormControl("", { nonNullable: true }),
    taxId: new FormControl("", { nonNullable: true, validators: [chileanRutValidator()] })
  });

  constructor(
    private readonly organizationService: OrganizationService,
    private readonly router: Router,
    private readonly notifications: NotificationService
  ) {}

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    try {
      const value = this.form.getRawValue();
      const organization = await this.organizationService.create({ ...value, taxId: normalizeChileanRut(value.taxId) || undefined });
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
