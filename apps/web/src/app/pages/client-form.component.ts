import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { ClientStatus, ClientType } from "../clients/client.models";
import { ClientPayload, ClientsService } from "../clients/clients.service";
import { OrganizationService } from "../organizations/organization.service";

@Component({
  selector: "kaklen-client-form",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header">
        <div>
          <p class="eyebrow">CRM</p>
          <h1>{{ clientId ? "Editar cliente" : "Nuevo cliente" }}</h1>
        </div>
        <a [routerLink]="['/organizations', organizationId, 'clients']">Volver</a>
      </section>

      <section class="dashboard-panel">
        <form [formGroup]="clientForm" (ngSubmit)="save()">
          <div class="field-grid">
            <label>
              Tipo
              <select formControlName="type">
                <option value="NATURAL_PERSON">Persona natural</option>
                <option value="LEGAL_ENTITY">Empresa</option>
              </select>
            </label>
            <label>
              Estado
              <select formControlName="status">
                <option value="LEAD">Lead</option>
                <option value="ACTIVE">Activo</option>
                <option value="INACTIVE">Inactivo</option>
                <option value="ARCHIVED">Archivado</option>
              </select>
            </label>
          </div>

          <div class="field-grid" *ngIf="clientForm.controls.type.value === 'NATURAL_PERSON'">
            <label>
              Nombre
              <input formControlName="firstName" maxlength="80" />
              <small *ngIf="showError('firstName')">El nombre es obligatorio.</small>
            </label>
            <label>
              Apellido
              <input formControlName="lastName" maxlength="80" />
              <small *ngIf="showError('lastName')">El apellido es obligatorio.</small>
            </label>
          </div>

          <label *ngIf="clientForm.controls.type.value === 'LEGAL_ENTITY'">
            Razón social
            <input formControlName="legalName" maxlength="160" />
            <small *ngIf="showError('legalName')">La razón social es obligatoria.</small>
          </label>

          <div class="field-grid">
            <label>
              RUT o tax ID
              <input formControlName="taxId" maxlength="40" />
            </label>
            <label>
              Email
              <input type="email" formControlName="email" />
              <small *ngIf="showError('email')">Ingresa un email válido.</small>
            </label>
            <label>
              Teléfono
              <input formControlName="phone" maxlength="40" />
            </label>
            <label>
              WhatsApp
              <input formControlName="whatsapp" maxlength="40" />
            </label>
            <label>
              País
              <input formControlName="country" maxlength="80" />
            </label>
            <label>
              Región
              <input formControlName="region" maxlength="120" />
            </label>
            <label>
              Ciudad
              <input formControlName="city" maxlength="120" />
            </label>
            <label>
              Dirección
              <input formControlName="address" maxlength="240" />
            </label>
          </div>

          <label>
            Notas
            <textarea formControlName="notes" maxlength="2000"></textarea>
          </label>

          <p class="form-error" *ngIf="error()">{{ error() }}</p>

          <div class="row-actions">
            <button type="submit" [disabled]="loading() || clientForm.invalid">Guardar</button>
            <a class="secondary-link" [routerLink]="['/organizations', organizationId, 'clients']">Cancelar</a>
          </div>
        </form>
      </section>
    </main>
  `
})
export class ClientFormComponent implements OnInit {
  readonly loading = signal(false);
  readonly error = signal("");
  readonly clientForm = new FormGroup({
    type: new FormControl<ClientType>("NATURAL_PERSON", { nonNullable: true }),
    status: new FormControl<ClientStatus>("LEAD", { nonNullable: true }),
    firstName: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(80)] }),
    lastName: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(80)] }),
    legalName: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(160)] }),
    taxId: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(40)] }),
    email: new FormControl("", { nonNullable: true, validators: [Validators.email] }),
    phone: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(40)] }),
    whatsapp: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(40)] }),
    country: new FormControl("CL", { nonNullable: true, validators: [Validators.maxLength(80)] }),
    region: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(120)] }),
    city: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(120)] }),
    address: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(240)] }),
    notes: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(2000)] })
  });
  organizationId = "";
  clientId = "";

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly clientsService: ClientsService,
    private readonly organizationService: OrganizationService
  ) {}

  async ngOnInit(): Promise<void> {
    this.organizationId = this.route.snapshot.paramMap.get("organizationId") ?? "";
    this.clientId = this.route.snapshot.paramMap.get("clientId") ?? "";
    await this.organizationService.setActiveOrganization(this.organizationId);
    this.clientForm.controls.type.valueChanges.subscribe(() => this.applyTypeValidators());
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
      await this.router.navigate(["/organizations", this.organizationId, "clients", client.id]);
    } catch {
      this.error.set("No fue posible guardar el cliente. Revisa los datos e intenta nuevamente.");
    } finally {
      this.loading.set(false);
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
        whatsapp: client.whatsapp ?? "",
        country: client.country,
        region: client.region ?? "",
        city: client.city ?? "",
        address: client.address ?? "",
        notes: client.notes ?? ""
      });
      this.applyTypeValidators();
    } catch {
      this.error.set("No fue posible cargar el cliente.");
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
      taxId: this.optional(value.taxId),
      email: this.optional(value.email),
      phone: this.optional(value.phone),
      whatsapp: this.optional(value.whatsapp),
      country: this.optional(value.country) ?? "CL",
      region: this.optional(value.region),
      city: this.optional(value.city),
      address: this.optional(value.address),
      notes: this.optional(value.notes)
    };
  }

  private optional(value: string): string | undefined {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
}
