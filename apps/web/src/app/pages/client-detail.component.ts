import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Client, ClientInteraction, ClientInteractionType } from "../clients/client.models";
import { ClientsService } from "../clients/clients.service";
import { formatRegionalDate } from "../i18n/formatting";
import { clientStatusLabel, countryLabel } from "../i18n/display-labels";
import { OrganizationService } from "../organizations/organization.service";
import { NotificationService } from "../shared/notifications/notification.service";
import { ConfirmationDialogComponent } from "../shared/confirmation-dialog.component";

@Component({
  selector: "kaklen-client-detail",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ConfirmationDialogComponent],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header" *ngIf="client() as currentClient">
        <div>
          <p class="eyebrow" i18n="@@clientEyebrow">Cliente</p>
          <h1>{{ currentClient.displayName }}</h1>
          <p>{{ typeLabel(currentClient.type) }} · {{ statusLabel(currentClient.status) }}</p>
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
          <details class="action-menu" *ngIf="canDelete() && currentClient.status !== 'ARCHIVED'">
            <summary aria-label="Más acciones" i18n-aria-label="@@moreActionsLabel">•••</summary>
            <div class="action-menu-panel">
              <button type="button" class="danger" (click)="archiveRequested.set(true)" i18n="@@archiveButton">Archivar</button>
            </div>
          </details>
        </div>
      </section>

      <p class="form-error" *ngIf="error()">{{ error() }}</p>

      <nav class="client-quick-actions" *ngIf="client() as currentClient" aria-label="Acciones rápidas del cliente" i18n-aria-label="@@clientQuickActionsLabel">
        <a *ngIf="currentClient.phone" class="secondary-link" [href]="'tel:' + currentClient.phone" i18n="@@callClientAction">Llamar</a>
        <a *ngIf="currentClient.whatsapp" class="secondary-link" [href]="whatsappUrl(currentClient.whatsapp)" target="_blank" rel="noopener" i18n="@@whatsappClientAction">WhatsApp</a>
        <a *ngIf="currentClient.email" class="secondary-link" [href]="'mailto:' + currentClient.email" i18n="@@emailClientAction">Enviar email</a>
        <a *ngIf="canCreateQuotation()" class="button-link" [routerLink]="['/organizations', organizationId, 'quotations', 'new']" [queryParams]="{ clientId: currentClient.id }" i18n="@@newQuotationButton">Nueva cotización</a>
        <a *ngIf="canCreateEvent()" class="secondary-link" [routerLink]="['/organizations', organizationId, 'events', 'new']" [queryParams]="{ clientId: currentClient.id }" i18n="@@newEventButton">Nuevo evento</a>
        <button *ngIf="canUpdate()" type="button" class="secondary" (click)="scrollToInteraction()" i18n="@@registerInteractionAction">Registrar interacción</button>
      </nav>

      <section class="dashboard-panel" *ngIf="client() as currentClient">
        <h2 i18n="@@dataTitle">Datos</h2>
        <dl class="detail-grid">
          <div>
            <dt i18n="@@taxIdLabel">RUT o identificación tributaria</dt>
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

      <section id="client-interaction-form" class="dashboard-panel" *ngIf="canUpdate()">
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
      <kaklen-confirmation-dialog
        [open]="archiveRequested()"
        [busy]="loading()"
        [title]="archiveDialogTitle"
        [description]="archiveDialogDescription"
        [confirmLabel]="archiveLabel"
        (confirm)="archive()"
        (cancel)="archiveRequested.set(false)"
      />
    </main>
  `
})
export class ClientDetailComponent implements OnInit {
  readonly loading = signal(false);
  readonly error = signal("");
  readonly archiveRequested = signal(false);
  readonly client = signal<Client | null>(null);
  readonly interactions = signal<ClientInteraction[]>([]);
  readonly emptyValueLabel = $localize`:@@emptyValueLabel:Sin informar`;
  readonly emptyNotesLabel = $localize`:@@emptyNotesLabel:Sin notas`;
  readonly emptySubjectLabel = $localize`:@@emptySubjectLabel:Sin asunto`;
  readonly archiveDialogTitle = $localize`:@@archiveClientDialogTitle:Archivar cliente`;
  readonly archiveDialogDescription = $localize`:@@archiveClientDialogDescription:El cliente dejará de aparecer en los listados habituales, pero su historial se conservará.`;
  readonly archiveLabel = $localize`:@@archiveButton:Archivar`;
  readonly undoLabel = $localize`:@@undoButton:Deshacer`;
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
    private readonly router: Router,
    private readonly clientsService: ClientsService,
    private readonly organizationService: OrganizationService,
    private readonly notifications: NotificationService
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

  canDelete(): boolean {
    return this.organizationService.hasPermission("clients.delete");
  }

  canCreateQuotation(): boolean {
    return this.organizationService.hasPermission("quotations.create");
  }

  canCreateEvent(): boolean {
    return this.organizationService.hasPermission("events.create");
  }

  typeLabel(type: Client["type"]): string {
    return type === "NATURAL_PERSON" ? $localize`:@@naturalPersonLabel:Persona natural` : $localize`:@@companyLabel:Empresa`;
  }

  statusLabel(status: Client["status"]): string {
    return clientStatusLabel(status);
  }

  locationLabel(client: Client): string {
    return [client.address, client.city, client.region, countryLabel(client.country)].filter(Boolean).join(", ");
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

  whatsappUrl(value: string): string {
    return `https://wa.me/${value.replace(/\D/g, "")}`;
  }

  scrollToInteraction(): void {
    const interactionForm = document.getElementById("client-interaction-form");
    interactionForm?.scrollIntoView({ behavior: "smooth", block: "start" });
    interactionForm?.querySelector<HTMLElement>("select, input, textarea")?.focus();
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
      this.notifications.success($localize`:@@interactionAddedSuccess:Interacción agregada correctamente.`);
      this.interactionForm.reset({ type: "NOTE", subject: "", description: "" });
      await this.loadInteractions();
    } catch (error) {
      this.notifications.fromError(error);
      this.error.set($localize`:@@interactionAddError:No fue posible agregar la interacción.`);
    } finally {
      this.loading.set(false);
    }
  }

  async archive(): Promise<void> {
    const currentClient = this.client();
    if (!currentClient || this.loading()) {
      return;
    }
    this.loading.set(true);
    this.error.set("");
    try {
      await this.clientsService.archive(this.organizationId, currentClient.id);
      this.archiveRequested.set(false);
      this.notifications.success(
        $localize`:@@clientArchivedSuccess:Cliente archivado correctamente.`,
        this.undoLabel,
        () => void this.restoreClient(currentClient)
      );
      await this.router.navigate(["/organizations", this.organizationId, "clients"]);
    } catch (error) {
      this.notifications.fromError(error);
      this.error.set($localize`:@@clientArchiveError:No fue posible archivar el cliente.`);
    } finally {
      this.loading.set(false);
    }
  }

  private async restoreClient(client: Client): Promise<void> {
    try {
      await this.clientsService.update(this.organizationId, client.id, { type: client.type, status: client.status });
      this.notifications.success($localize`:@@clientRestoredSuccess:Cliente restaurado correctamente.`);
    } catch (error) {
      this.notifications.fromError(error);
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
    } catch (error) {
      this.notifications.fromError(error);
      this.error.set($localize`:@@clientLoadError:No fue posible cargar el cliente.`);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadInteractions(): Promise<void> {
    this.interactions.set(await this.clientsService.interactions(this.organizationId, this.clientId));
  }
}
