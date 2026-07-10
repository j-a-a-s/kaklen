import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { Client, ClientInteraction, ClientInteractionType } from "../clients/client.models";
import { ClientsService } from "../clients/clients.service";
import { OrganizationService } from "../organizations/organization.service";

@Component({
  selector: "kaklen-client-detail",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header" *ngIf="client() as currentClient">
        <div>
          <p class="eyebrow">Cliente</p>
          <h1>{{ currentClient.displayName }}</h1>
          <p>{{ currentClient.type === "NATURAL_PERSON" ? "Persona natural" : "Empresa" }} · {{ currentClient.status }}</p>
        </div>
        <div class="row-actions">
          <a [routerLink]="['/organizations', organizationId, 'clients']">Volver</a>
          <a
            *ngIf="canUpdate()"
            class="button-link"
            [routerLink]="['/organizations', organizationId, 'clients', currentClient.id, 'edit']"
          >
            Editar
          </a>
        </div>
      </section>

      <p class="form-error" *ngIf="error()">{{ error() }}</p>

      <section class="dashboard-panel" *ngIf="client() as currentClient">
        <h2>Datos</h2>
        <dl class="detail-grid">
          <div>
            <dt>Tax ID</dt>
            <dd>{{ currentClient.taxId || "Sin informar" }}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{{ currentClient.email || "Sin informar" }}</dd>
          </div>
          <div>
            <dt>Teléfono</dt>
            <dd>{{ currentClient.phone || "Sin informar" }}</dd>
          </div>
          <div>
            <dt>WhatsApp</dt>
            <dd>{{ currentClient.whatsapp || "Sin informar" }}</dd>
          </div>
          <div>
            <dt>Ubicación</dt>
            <dd>{{ locationLabel(currentClient) }}</dd>
          </div>
          <div>
            <dt>Notas</dt>
            <dd>{{ currentClient.notes || "Sin notas" }}</dd>
          </div>
        </dl>
      </section>

      <section class="dashboard-panel" *ngIf="canUpdate()">
        <h2>Nueva interacción</h2>
        <form [formGroup]="interactionForm" (ngSubmit)="addInteraction()">
          <div class="field-grid">
            <label>
              Tipo
              <select formControlName="type">
                <option value="NOTE">Nota</option>
                <option value="CALL">Llamada</option>
                <option value="EMAIL">Email</option>
                <option value="MEETING">Reunión</option>
                <option value="WHATSAPP">WhatsApp</option>
              </select>
            </label>
            <label>
              Asunto
              <input formControlName="subject" maxlength="160" />
            </label>
          </div>
          <label>
            Descripción
            <textarea formControlName="description" maxlength="2000"></textarea>
            <small *ngIf="interactionForm.controls.description.invalid && interactionForm.controls.description.touched">
              La descripción es obligatoria.
            </small>
          </label>
          <button type="submit" [disabled]="loading() || interactionForm.invalid">Agregar</button>
        </form>
      </section>

      <section class="list-panel">
        <article class="item-row" *ngFor="let interaction of interactions()">
          <div>
            <strong>{{ interactionLabel(interaction.type) }}</strong>
            <small>{{ interaction.occurredAt | date: "short" }} · {{ interaction.subject || "Sin asunto" }}</small>
            <p>{{ interaction.description }}</p>
          </div>
        </article>
      </section>
    </main>
  `
})
export class ClientDetailComponent implements OnInit {
  readonly loading = signal(false);
  readonly error = signal("");
  readonly client = signal<Client | null>(null);
  readonly interactions = signal<ClientInteraction[]>([]);
  readonly interactionForm = new FormGroup({
    type: new FormControl<ClientInteractionType>("NOTE", { nonNullable: true }),
    subject: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(160)] }),
    description: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(2000)]
    })
  });
  organizationId = "";
  clientId = "";

  constructor(
    private readonly route: ActivatedRoute,
    private readonly clientsService: ClientsService,
    private readonly organizationService: OrganizationService
  ) {}

  async ngOnInit(): Promise<void> {
    this.organizationId = this.route.snapshot.paramMap.get("organizationId") ?? "";
    this.clientId = this.route.snapshot.paramMap.get("clientId") ?? "";
    await this.organizationService.setActiveOrganization(this.organizationId);
    await this.load();
  }

  canUpdate(): boolean {
    return this.organizationService.hasPermission("clients.update");
  }

  locationLabel(client: Client): string {
    return [client.address, client.city, client.region, client.country].filter(Boolean).join(", ");
  }

  interactionLabel(type: ClientInteractionType): string {
    const labels: Record<ClientInteractionType, string> = {
      NOTE: "Nota",
      CALL: "Llamada",
      EMAIL: "Email",
      MEETING: "Reunión",
      WHATSAPP: "WhatsApp"
    };
    return labels[type];
  }

  async addInteraction(): Promise<void> {
    this.interactionForm.markAllAsTouched();
    if (this.interactionForm.invalid) {
      return;
    }
    this.loading.set(true);
    this.error.set("");
    try {
      const value = this.interactionForm.getRawValue();
      await this.clientsService.addInteraction(this.organizationId, this.clientId, {
        type: value.type,
        subject: value.subject.trim() || undefined,
        description: value.description.trim()
      });
      this.interactionForm.reset({ type: "NOTE", subject: "", description: "" });
      await this.loadInteractions();
    } catch {
      this.error.set("No fue posible agregar la interacción.");
    } finally {
      this.loading.set(false);
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set("");
    try {
      const [client, interactions] = await Promise.all([
        this.clientsService.get(this.organizationId, this.clientId),
        this.clientsService.interactions(this.organizationId, this.clientId)
      ]);
      this.client.set(client);
      this.interactions.set(interactions);
    } catch {
      this.error.set("No fue posible cargar el cliente.");
    } finally {
      this.loading.set(false);
    }
  }

  private async loadInteractions(): Promise<void> {
    this.interactions.set(await this.clientsService.interactions(this.organizationId, this.clientId));
  }
}
