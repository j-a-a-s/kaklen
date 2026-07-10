import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { Client, ClientInteraction, ClientInteractionType } from "../clients/client.models";
import { ClientsService } from "../clients/clients.service";
import { formatRegionalDate } from "../i18n/formatting";
import { OrganizationService } from "../organizations/organization.service";

@Component({
  selector: "kaklen-client-detail",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header" *ngIf="client() as currentClient">
        <div>
          <p class="eyebrow" i18n="@@clientEyebrow">Cliente</p>
          <h1>{{ currentClient.displayName }}</h1>
          <p>{{ typeLabel(currentClient.type) }} · {{ currentClient.status }}</p>
        </div>
        <div class="row-actions">
          <a [routerLink]="['/organizations', organizationId, 'clients']" i18n="@@backLink">Volver</a>
          <a
            *ngIf="canUpdate()"
            class="button-link"
            [routerLink]="['/organizations', organizationId, 'clients', currentClient.id, 'edit']"
          >
            <span i18n="@@editLink">Editar</span>
          </a>
        </div>
      </section>

      <p class="form-error" *ngIf="error()">{{ error() }}</p>

      <section class="dashboard-panel" *ngIf="client() as currentClient">
        <h2 i18n="@@dataTitle">Datos</h2>
        <dl class="detail-grid">
          <div>
            <dt i18n="@@taxIdLabel">Tax ID</dt>
            <dd>{{ currentClient.taxId || emptyValueLabel }}</dd>
          </div>
          <div>
            <dt i18n="@@emailLabel">Email</dt>
            <dd>{{ currentClient.email || emptyValueLabel }}</dd>
          </div>
          <div>
            <dt i18n="@@phoneLabel">Teléfono</dt>
            <dd>{{ currentClient.phone || emptyValueLabel }}</dd>
          </div>
          <div>
            <dt i18n="@@whatsappLabel">WhatsApp</dt>
            <dd>{{ currentClient.whatsapp || emptyValueLabel }}</dd>
          </div>
          <div>
            <dt i18n="@@locationLabel">Ubicación</dt>
            <dd>{{ locationLabel(currentClient) }}</dd>
          </div>
          <div>
            <dt i18n="@@notesLabel">Notas</dt>
            <dd>{{ currentClient.notes || emptyNotesLabel }}</dd>
          </div>
        </dl>
      </section>

      <section class="dashboard-panel" *ngIf="canUpdate()">
        <h2 i18n="@@newInteractionTitle">Nueva interacción</h2>
        <form [formGroup]="interactionForm" (ngSubmit)="addInteraction()">
          <div class="field-grid">
            <label>
              <span i18n="@@typeLabel">Tipo</span>
              <select formControlName="type">
                <option value="NOTE" i18n="@@noteOption">Nota</option>
                <option value="CALL" i18n="@@callOption">Llamada</option>
                <option value="EMAIL" i18n="@@emailOption">Email</option>
                <option value="MEETING" i18n="@@meetingOption">Reunión</option>
                <option value="WHATSAPP" i18n="@@whatsappOption">WhatsApp</option>
              </select>
            </label>
            <label>
              <span i18n="@@subjectLabel">Asunto</span>
              <input formControlName="subject" maxlength="160" />
            </label>
          </div>
          <label>
            <span i18n="@@descriptionLabel">Descripción</span>
            <textarea formControlName="description" maxlength="2000"></textarea>
            <small *ngIf="interactionForm.controls.description.invalid && interactionForm.controls.description.touched">
              <span i18n="@@descriptionRequired">La descripción es obligatoria.</span>
            </small>
          </label>
          <button type="submit" [disabled]="loading() || interactionForm.invalid" i18n="@@addButton">Agregar</button>
        </form>
      </section>

      <section class="list-panel">
        <article class="item-row" *ngFor="let interaction of interactions()">
          <div>
            <strong>{{ interactionLabel(interaction.type) }}</strong>
            <small>{{ dateLabel(interaction.occurredAt) }} · {{ interaction.subject || emptySubjectLabel }}</small>
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
  readonly emptyValueLabel = $localize`:@@emptyValueLabel:Sin informar`;
  readonly emptyNotesLabel = $localize`:@@emptyNotesLabel:Sin notas`;
  readonly emptySubjectLabel = $localize`:@@emptySubjectLabel:Sin asunto`;
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

  typeLabel(type: Client["type"]): string {
    return type === "NATURAL_PERSON" ? $localize`:@@naturalPersonLabel:Persona natural` : $localize`:@@companyLabel:Empresa`;
  }

  locationLabel(client: Client): string {
    return [client.address, client.city, client.region, client.country].filter(Boolean).join(", ");
  }

  dateLabel(value: string): string {
    const organization = this.organizationService.activeOrganization();
    return formatRegionalDate(value, {
      dateFormat: organization?.dateFormat ?? "dd-MM-yyyy",
      numberFormat: organization?.numberFormat ?? "es"
    });
  }

  interactionLabel(type: ClientInteractionType): string {
    const labels: Record<ClientInteractionType, string> = {
      NOTE: $localize`:@@noteLabel:Nota`,
      CALL: $localize`:@@callLabel:Llamada`,
      EMAIL: $localize`:@@emailInteractionLabel:Email`,
      MEETING: $localize`:@@meetingLabel:Reunión`,
      WHATSAPP: $localize`:@@whatsappLabel:WhatsApp`
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
      this.error.set($localize`:@@interactionAddError:No fue posible agregar la interacción.`);
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
      this.error.set($localize`:@@clientLoadError:No fue posible cargar el cliente.`);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadInteractions(): Promise<void> {
    this.interactions.set(await this.clientsService.interactions(this.organizationId, this.clientId));
  }
}
