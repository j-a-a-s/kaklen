import { CommonModule } from "@angular/common";
import { Component, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { OrganizationService } from "../organizations/organization.service";

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
    <main class="auth-shell">
      <section class="auth-panel">
        <p class="eyebrow">Nueva organización</p>
        <h1>Crear organización</h1>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <label>
            Nombre
            <input formControlName="name" />
          </label>
          <label>
            Razón social
            <input formControlName="legalName" />
          </label>
          <label>
            RUT o tax ID
            <input formControlName="taxId" />
          </label>
          <p class="form-error" *ngIf="error()">{{ error() }}</p>
          <button type="submit" [disabled]="form.invalid || loading()">
            {{ loading() ? "Creando..." : "Crear" }}
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
    taxId: new FormControl("", { nonNullable: true })
  });

  constructor(
    private readonly organizationService: OrganizationService,
    private readonly router: Router
  ) {}

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    try {
      const organization = await this.organizationService.create(this.form.getRawValue());
      await this.organizationService.setActiveOrganization(organization.id);
      await this.router.navigate(["/organizations", organization.id, "members"]);
    } catch {
      this.error.set("No pudimos crear la organización.");
    } finally {
      this.loading.set(false);
    }
  }
}
