import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { OrganizationService } from "../organizations/organization.service";

@Component({
  selector: "kaklen-organization-settings",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <main class="auth-shell">
      <section class="auth-panel">
        <p class="eyebrow">Ajustes</p>
        <h1>Organización</h1>
        <form [formGroup]="form" (ngSubmit)="save()">
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
          <p class="form-error" *ngIf="message()">{{ message() }}</p>
          <button type="submit" [disabled]="form.invalid || loading()">Guardar</button>
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
    taxId: new FormControl("", { nonNullable: true })
  });
  private organizationId = "";

  constructor(
    private readonly route: ActivatedRoute,
    private readonly organizationService: OrganizationService
  ) {}

  async ngOnInit(): Promise<void> {
    this.organizationId = this.route.snapshot.paramMap.get("organizationId") ?? "";
    const organization = await this.organizationService.get(this.organizationId);
    this.form.setValue({
      name: organization.name,
      legalName: organization.legalName ?? "",
      taxId: organization.taxId ?? ""
    });
  }

  async save(): Promise<void> {
    this.loading.set(true);
    this.message.set(null);
    try {
      await this.organizationService.update(this.organizationId, this.form.getRawValue());
      this.message.set("Organización actualizada.");
    } catch {
      this.message.set("No pudimos guardar los cambios.");
    } finally {
      this.loading.set(false);
    }
  }
}
