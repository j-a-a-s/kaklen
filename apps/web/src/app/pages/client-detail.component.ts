import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Client, ClientInteractionType } from "../clients/client.models";
import { ClientsService } from "../clients/clients.service";
import { formatRegionalDate } from "../i18n/formatting";
import { clientStatusLabel, countryLabel } from "../i18n/display-labels";
import { OrganizationService } from "../organizations/organization.service";
import { NotificationService } from "../shared/notifications/notification.service";
import { ConfirmationDialogComponent } from "../shared/confirmation-dialog.component";
import { AssistantService } from "../assistant/assistant.service";
import { ClientTimelineItem } from "../assistant/assistant.models";
import { eventStatusLabel, quotationStatusLabel } from "../i18n/display-labels";
import { ActionMenuComponent, ActionMenuItemDirective } from "../shared/action-menu.component";
import { UiIconComponent, UiIconName } from "../shared/ui-icon.component";
import { trimmedRequired } from "../shared/forms/form-validators";
import { FieldErrorComponent, FormControlA11yDirective, FormErrorSummaryComponent,   FormFieldComponent
} from "../shared/forms/form-feedback.components";

@Component({
  selector: "kaklen-client-detail",
  standalone: true,
  imports: [FormFieldComponent, CommonModule, ReactiveFormsModule, RouterLink, ConfirmationDialogComponent, ActionMenuComponent, ActionMenuItemDirective, UiIconComponent, FieldErrorComponent, FormControlA11yDirective, FormErrorSummaryComponent],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header" *ngIf="client() as currentClient">
        <div>
          <p class="eyebrow" i18n="@@clientEyebrow">Cliente</p>
          <h1>{{ currentClient.displayName }}</h1>
          <p>{{ typeLabel(currentClient.type) }} · {{ statusLabel(currentClient.status) }}</p>
        </div>
        <div class="row-actions">
          <a class="ghost button-link" [routerLink]="['/organizations', organizationId, 'clients']"><kaklen-icon name="arrow-left" /><span i18n="@@backLink">Volver</span></a>
          <a
            *ngIf="canUpdate()"
            class="button-link"
            [routerLink]="['/organizations', organizationId, 'clients', currentClient.id, 'edit']"
          >
            <kaklen-icon name="pencil" /><span i18n="@@editLink">Editar</span>
          </a>
          <kaklen-action-menu *ngIf="canDelete() && currentClient.status !== 'ARCHIVED'" [contextKey]="organizationId">
            <button kaklenMenuItem type="button" class="danger" (click)="archiveRequested.set(true)"><kaklen-icon name="archive" /><span i18n="@@archiveButton">Archivar</span></button>
          </kaklen-action-menu>
        </div>
      </section>

      <p class="form-error" *ngIf="error()">{{ error() }}</p>

      <nav class="client-quick-actions" *ngIf="client() as currentClient" aria-label="Acciones rápidas del cliente" i18n-aria-label="@@clientQuickActionsLabel">
        <a *ngIf="currentClient.phone" class="secondary-link" [href]="'tel:' + currentClient.phone"><kaklen-icon name="phone" /><span i18n="@@callClientAction">Llamar</span></a>
        <a *ngIf="currentClient.whatsapp" class="secondary-link" [href]="whatsappUrl(currentClient.whatsapp)" target="_blank" rel="noopener"><kaklen-icon name="message-circle" /><span i18n="@@whatsappClientAction">WhatsApp</span></a>
        <a *ngIf="currentClient.email" class="secondary-link" [href]="'mailto:' + currentClient.email"><kaklen-icon name="mail" /><span i18n="@@emailClientAction">Enviar email</span></a>
        <a *ngIf="canCreateQuotation()" class="button-link" [routerLink]="['/organizations', organizationId, 'quotations', 'new']" [queryParams]="{ clientId: currentClient.id }"><kaklen-icon name="plus" /><span i18n="@@newQuotationButton">Nueva cotización</span></a>
        <a *ngIf="canCreateEvent()" class="secondary-link" [routerLink]="['/organizations', organizationId, 'events', 'new']" [queryParams]="{ clientId: currentClient.id }"><kaklen-icon name="calendar" /><span i18n="@@newEventButton">Nuevo evento</span></a>
        <button *ngIf="canUpdate()" type="button" class="secondary" (click)="scrollToInteraction()"><kaklen-icon name="plus" /><span i18n="@@registerInteractionAction">Registrar interacción</span></button>
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
          <kaklen-form-error-summary [form]="interactionForm" [attempted]="interactionSubmitted()" [labels]="interactionFieldLabels" />
          <div class="field-grid">
            <label kaklen-form-field label="Tipo" i18n-label="@@typeLabel" controlId="client-detail-type" required="auto" invalid="auto">
              <select kaklenControl formControlName="type">
                <option value="NOTE" i18n="@@noteOption">Nota</option>
                <option value="CALL" i18n="@@callOption">Llamada</option>
                <option value="EMAIL" i18n="@@emailOption">Email</option>
                <option value="MEETING" i18n="@@meetingOption">Reunión</option>
                <option value="WHATSAPP" i18n="@@whatsappOption">WhatsApp</option>
              </select>
            </label>
            <label kaklen-form-field label="Asunto" i18n-label="@@subjectLabel" controlId="client-detail-subject" required="auto" invalid="auto">
              <input kaklenControl formControlName="subject" maxlength="160" />
            </label>
          </div>
          <label kaklen-form-field label="Descripción" i18n-label="@@descriptionLabel" controlId="client-detail-description" required="auto" invalid="auto">
            <textarea kaklenControl formControlName="description" maxlength="2000" aria-required="true" aria-describedby="interaction-description-error"></textarea>
            <kaklen-field-error id="interaction-description-error" [control]="interactionForm.controls.description" [attempted]="interactionSubmitted()" />
          </label>
          <button type="submit" [disabled]="loading()"><kaklen-icon name="plus" /><span i18n="@@addButton">Agregar</span></button>
        </form>
      </section>

      <section class="dashboard-panel client-timeline-panel">
        <div class="section-heading"><div><p class="eyebrow" i18n="@@clientHistoryEyebrow">Relación con el cliente</p><h2 i18n="@@clientTimelineTitle">Línea de tiempo</h2></div></div>
        <ol class="client-timeline" aria-label="Línea de tiempo del cliente" i18n-aria-label="@@clientTimelineAriaLabel">
          <li *ngFor="let entry of timeline()">
            <span class="timeline-marker" aria-hidden="true"><kaklen-icon [name]="timelineIcon(entry.type)" /></span>
            <div><strong>{{ timelineLabel(entry.type) }}</strong><p>{{ timelineDescription(entry) }}</p><small>{{ dateLabel(entry.occurredAt) }}<ng-container *ngIf="entry.actor"> · {{ entry.actor.name }}</ng-container><ng-container *ngIf="entry.status"> · {{ timelineStatus(entry) }}</ng-container></small></div>
            <a *ngIf="entry.resource.type !== 'client'" [routerLink]="entry.resource.route" i18n="@@openResourceAction">Abrir</a>
          </li>
        </ol>
        <p class="empty-inline" *ngIf="timeline().length === 0" i18n="@@emptyClientTimeline">La actividad del cliente aparecerá aquí cuando registres interacciones, cotizaciones o eventos.</p>
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
  readonly timeline = signal<ClientTimelineItem[]>([]);
  readonly interactionSubmitted = signal(false);
  readonly interactionFieldLabels = { type: $localize`:@@typeLabel:Tipo`, subject: $localize`:@@subjectLabel:Asunto`, description: $localize`:@@descriptionLabel:Descripción` };
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
      validators: [Validators.required, trimmedRequired(), Validators.maxLength(2000)]
    })
  });
  organizationId = "";
  clientId = "";

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly clientsService: ClientsService,
    private readonly organizationService: OrganizationService,
    private readonly notifications: NotificationService,
    private readonly assistantService: AssistantService
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

  timelineLabel(type: string): string {
    const labels: Readonly<Record<string, string>> = {
      "client.created": $localize`:@@timelineClientCreated:Cliente creado`,
      "client.updated": $localize`:@@timelineClientUpdated:Datos del cliente actualizados`,
      "client.archived": $localize`:@@timelineClientArchived:Cliente archivado`,
      "interaction.note": $localize`:@@timelineNote:Nota registrada`,
      "interaction.call": $localize`:@@timelineCall:Llamada registrada`,
      "interaction.email": $localize`:@@timelineEmail:Email registrado`,
      "interaction.meeting": $localize`:@@timelineMeeting:Reunión registrada`,
      "interaction.whatsapp": $localize`:@@timelineWhatsapp:Conversación por WhatsApp`,
      "quotation.created": $localize`:@@timelineQuotationCreated:Cotización creada`,
      "quotation.sent": $localize`:@@timelineQuotationSent:Cotización enviada`,
      "quotation.approved": $localize`:@@timelineQuotationApproved:Cotización aprobada`,
      "quotation.rejected": $localize`:@@timelineQuotationRejected:Cotización rechazada`,
      "quotation.cancelled": $localize`:@@timelineQuotationCancelled:Cotización cancelada`,
      "event.created": $localize`:@@timelineEventCreated:Evento creado`,
      "event.completed": $localize`:@@timelineEventCompleted:Evento completado`,
      "event.cancelled": $localize`:@@timelineEventCancelled:Evento cancelado`
    };
    return labels[type] ?? $localize`:@@timelineResourceUpdated:Actividad actualizada`;
  }

  timelineIcon(type: string): UiIconName {
    if (type.startsWith("quotation.")) return "file-text";
    if (type.startsWith("event.")) return "calendar";
    if (type.startsWith("interaction.")) return "message-circle";
    return "user";
  }

  timelineDescription(entry: ClientTimelineItem): string {
    return entry.type.startsWith("interaction.") ? entry.description : entry.resource.title;
  }

  timelineStatus(entry: ClientTimelineItem): string {
    if (!entry.status) return "";
    if (entry.resource.type === "quotation") return quotationStatusLabel(entry.status as Parameters<typeof quotationStatusLabel>[0]);
    if (entry.resource.type === "event") return eventStatusLabel(entry.status as Parameters<typeof eventStatusLabel>[0]);
    return clientStatusLabel(entry.status as Parameters<typeof clientStatusLabel>[0]);
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
    this.interactionSubmitted.set(true);
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
      this.interactionSubmitted.set(false);
      await this.loadTimeline();
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
      const [client, timeline] = await Promise.all([
        this.clientsService.get(this.organizationId, this.clientId),
        this.assistantService.clientTimeline(this.organizationId, this.clientId)
      ]);
      this.client.set(client);
      this.timeline.set(timeline);
    } catch (error) {
      this.notifications.fromError(error);
      this.error.set($localize`:@@clientLoadError:No fue posible cargar el cliente.`);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadTimeline(): Promise<void> {
    this.timeline.set(await this.assistantService.clientTimeline(this.organizationId, this.clientId));
  }
}
