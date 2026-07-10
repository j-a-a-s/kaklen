import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Event, EventParticipantRole, EventStatus, EventTaskPriority } from "../events/event.models";
import { EventsService } from "../events/events.service";
import { formatRegionalCurrency, formatRegionalDate } from "../i18n/formatting";
import { OrganizationService } from "../organizations/organization.service";

@Component({
  selector: "kaklen-event-detail",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <main class="dashboard-shell" *ngIf="event() as item">
      <section class="dashboard-header">
        <div>
          <p class="eyebrow" i18n="@@eventsEyebrow">Eventos</p>
          <h1>{{ item.code }} · {{ item.name }}</h1>
          <p>{{ statusLabel(item.status) }} · {{ dateLabel(item.startAt) }} - {{ dateLabel(item.endAt) }}</p>
        </div>
        <div class="row-actions">
          <a class="secondary button-link" [routerLink]="['/organizations', organizationId, 'events']" i18n="@@backToListButton">Volver al listado</a>
          <a *ngIf="canUpdate()" class="button-link" [routerLink]="['/organizations', organizationId, 'events', item.id, 'edit']" i18n="@@editLink">Editar</a>
        </div>
      </section>

      <section class="dashboard-panel">
        <div class="metrics-grid">
          <span><strong>{{ item.client?.displayName || noClientLabel }}</strong><small i18n="@@clientLabel">Cliente</small></span>
          <span><strong>{{ item.venueName || noVenueLabel }}</strong><small i18n="@@venueNameLabel">Lugar</small></span>
          <span><strong>{{ item.city || noCityLabel }}</strong><small i18n="@@cityLabel">Ciudad</small></span>
          <span><strong>{{ item.budget ? moneyLabel(item.budget, item.currency) : noBudgetLabel }}</strong><small i18n="@@budgetLabel">Presupuesto</small></span>
        </div>
        <p *ngIf="item.description">{{ item.description }}</p>
        <p *ngIf="item.notes">{{ item.notes }}</p>
        <div class="row-actions" *ngIf="canManage()">
          <button type="button" class="secondary" (click)="changeStatus('confirm')" [disabled]="item.status !== 'DRAFT'" i18n="@@confirmButton">Confirmar</button>
          <button type="button" class="secondary" (click)="changeStatus('start')" [disabled]="item.status !== 'CONFIRMED'" i18n="@@startEventButton">Iniciar</button>
          <button type="button" class="secondary" (click)="changeStatus('complete')" [disabled]="item.status !== 'IN_PROGRESS'" i18n="@@completeButton">Completar</button>
          <button type="button" class="danger" (click)="changeStatus('cancel')" [disabled]="item.status === 'COMPLETED' || item.status === 'CANCELLED'" i18n="@@cancelButton">Cancelar</button>
          <button *ngIf="canDelete()" type="button" class="danger" (click)="archive()" i18n="@@archiveButton">Archivar</button>
        </div>
      </section>

      <p class="form-error" *ngIf="error()">{{ error() }}</p>

      <section class="dashboard-panel">
        <h2 i18n="@@tasksTitle">Tareas</h2>
        <form [formGroup]="taskForm" (ngSubmit)="addTask()">
          <div class="field-grid">
            <label>
              <span i18n="@@titleLabel">Título</span>
              <input formControlName="title" />
            </label>
            <label>
              <span i18n="@@priorityLabel">Prioridad</span>
              <select formControlName="priority">
                <option value="LOW" i18n="@@lowPriorityLabel">Baja</option>
                <option value="MEDIUM" i18n="@@mediumPriorityLabel">Media</option>
                <option value="HIGH" i18n="@@highPriorityLabel">Alta</option>
                <option value="URGENT" i18n="@@urgentPriorityLabel">Urgente</option>
              </select>
            </label>
          </div>
          <button type="submit" [disabled]="taskForm.invalid || !canUpdate()" i18n="@@addTaskButton">Agregar tarea</button>
        </form>
        <article class="item-row" *ngFor="let task of item.tasks">
          <span><strong>{{ task.title }}</strong><small>{{ task.status }} · {{ task.priority }}</small></span>
          <button type="button" class="secondary" (click)="completeTask(task.id, task.title)" [disabled]="task.status === 'COMPLETED' || !canUpdate()" i18n="@@completeButton">Completar</button>
        </article>
      </section>

      <section class="dashboard-panel">
        <h2 i18n="@@participantsTitle">Participantes</h2>
        <form [formGroup]="participantForm" (ngSubmit)="addParticipant()">
          <div class="field-grid">
            <label>
              <span i18n="@@nameLabel">Nombre</span>
              <input formControlName="externalName" />
            </label>
            <label>
              <span i18n="@@emailLabel">Email</span>
              <input type="email" formControlName="externalEmail" />
            </label>
            <label>
              <span i18n="@@roleLabel">Rol</span>
              <select formControlName="role">
                <option value="CLIENT_CONTACT" i18n="@@clientContactRoleLabel">Contacto cliente</option>
                <option value="COORDINATOR" i18n="@@coordinatorRoleLabel">Coordinador</option>
                <option value="STAFF" i18n="@@staffRoleLabel">Staff</option>
                <option value="SUPPLIER" i18n="@@supplierRoleLabel">Proveedor</option>
                <option value="GUEST" i18n="@@guestRoleLabel">Invitado</option>
              </select>
            </label>
          </div>
          <button type="submit" [disabled]="participantForm.invalid || !canUpdate()" i18n="@@addParticipantButton">Agregar participante</button>
        </form>
        <article class="item-row" *ngFor="let participant of item.participants">
          <span><strong>{{ participant.externalName || participant.externalEmail || participant.role }}</strong><small>{{ participant.role }}</small></span>
        </article>
      </section>

      <section class="dashboard-panel">
        <h2 i18n="@@resourcesTitle">Recursos</h2>
        <form [formGroup]="resourceForm" (ngSubmit)="addResource()">
          <div class="field-grid">
            <label>
              <span i18n="@@nameLabel">Nombre</span>
              <input formControlName="name" />
            </label>
            <label>
              <span i18n="@@quantityLabel">Cantidad</span>
              <input type="number" min="0.001" step="0.001" formControlName="quantity" />
            </label>
            <label>
              <span i18n="@@unitLabel">Unidad</span>
              <input formControlName="unit" />
            </label>
          </div>
          <button type="submit" [disabled]="resourceForm.invalid || !canUpdate()" i18n="@@addResourceButton">Agregar recurso</button>
        </form>
        <article class="item-row" *ngFor="let resource of item.resources">
          <span><strong>{{ resource.name }}</strong><small>{{ resource.quantity }} {{ resource.unit }}</small></span>
        </article>
      </section>

      <section class="dashboard-panel">
        <h2 i18n="@@timelineTitle">Cronograma</h2>
        <form [formGroup]="timelineForm" (ngSubmit)="addTimelineEntry()">
          <div class="field-grid">
            <label>
              <span i18n="@@titleLabel">Título</span>
              <input formControlName="title" />
            </label>
            <label>
              <span i18n="@@startAtLabel">Inicio</span>
              <input type="datetime-local" formControlName="startsAt" />
            </label>
          </div>
          <button type="submit" [disabled]="timelineForm.invalid || !canUpdate()" i18n="@@addTimelineEntryButton">Agregar al cronograma</button>
        </form>
        <article class="item-row" *ngFor="let entry of item.timeline">
          <span><strong>{{ entry.title }}</strong><small>{{ dateLabel(entry.startsAt) }}</small></span>
        </article>
      </section>
    </main>
  `
})
export class EventDetailComponent implements OnInit {
  readonly event = signal<Event | null>(null);
  readonly error = signal("");
  readonly noClientLabel = $localize`:@@noClientLabel:Sin cliente`;
  readonly noVenueLabel = $localize`:@@noVenueLabel:Sin lugar`;
  readonly noCityLabel = $localize`:@@noCityLabel:Sin ciudad`;
  readonly noBudgetLabel = $localize`:@@noBudgetLabel:Sin presupuesto`;
  organizationId = "";
  eventId = "";
  readonly taskForm = new FormGroup({
    title: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    priority: new FormControl<EventTaskPriority>("MEDIUM", { nonNullable: true })
  });
  readonly participantForm = new FormGroup({
    externalName: new FormControl("", { nonNullable: true }),
    externalEmail: new FormControl("", { nonNullable: true }),
    role: new FormControl<EventParticipantRole>("CLIENT_CONTACT", { nonNullable: true })
  });
  readonly resourceForm = new FormGroup({
    name: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    quantity: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(0.001)] }),
    unit: new FormControl("unidad", { nonNullable: true, validators: [Validators.required] })
  });
  readonly timelineForm = new FormGroup({
    title: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    startsAt: new FormControl("", { nonNullable: true, validators: [Validators.required] })
  });

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly organizationService: OrganizationService,
    private readonly eventsService: EventsService
  ) {}

  async ngOnInit(): Promise<void> {
    this.organizationId = this.route.snapshot.paramMap.get("organizationId") ?? "";
    this.eventId = this.route.snapshot.paramMap.get("eventId") ?? "";
    await this.organizationService.setActiveOrganization(this.organizationId);
    await this.load();
  }

  canUpdate(): boolean {
    return this.organizationService.hasPermission("events.update");
  }

  canManage(): boolean {
    return this.organizationService.hasPermission("events.manage");
  }

  canDelete(): boolean {
    return this.organizationService.hasPermission("events.delete");
  }

  async load(): Promise<void> {
    this.event.set(await this.eventsService.get(this.organizationId, this.eventId));
  }

  async changeStatus(action: "confirm" | "start" | "complete" | "cancel"): Promise<void> {
    try {
      this.event.set(await this.eventsService.changeStatus(this.organizationId, this.eventId, action));
    } catch {
      this.error.set($localize`:@@eventStatusError:No fue posible cambiar el estado del evento.`);
    }
  }

  async archive(): Promise<void> {
    if (!confirm($localize`:@@archiveEventConfirm:¿Archivar este evento?`)) {
      return;
    }
    await this.eventsService.archive(this.organizationId, this.eventId);
    await this.router.navigate(["/organizations", this.organizationId, "events"]);
  }

  async addTask(): Promise<void> {
    await this.eventsService.createTask(this.organizationId, this.eventId, this.taskForm.getRawValue());
    this.taskForm.reset({ title: "", priority: "MEDIUM" });
    await this.load();
  }

  async completeTask(taskId: string, title: string): Promise<void> {
    await this.eventsService.updateTask(this.organizationId, this.eventId, taskId, { title, status: "COMPLETED" });
    await this.load();
  }

  async addParticipant(): Promise<void> {
    await this.eventsService.createParticipant(this.organizationId, this.eventId, this.participantForm.getRawValue());
    this.participantForm.reset({ externalName: "", externalEmail: "", role: "CLIENT_CONTACT" });
    await this.load();
  }

  async addResource(): Promise<void> {
    await this.eventsService.createResource(this.organizationId, this.eventId, this.resourceForm.getRawValue());
    this.resourceForm.reset({ name: "", quantity: 1, unit: "unidad" });
    await this.load();
  }

  async addTimelineEntry(): Promise<void> {
    const value = this.timelineForm.getRawValue();
    await this.eventsService.createTimelineEntry(this.organizationId, this.eventId, {
      title: value.title,
      startsAt: new Date(value.startsAt).toISOString()
    });
    this.timelineForm.reset({ title: "", startsAt: "" });
    await this.load();
  }

  statusLabel(status: EventStatus): string {
    const labels: Record<EventStatus, string> = {
      DRAFT: $localize`:@@draftLabel:Borrador`,
      CONFIRMED: $localize`:@@confirmedLabel:Confirmado`,
      IN_PROGRESS: $localize`:@@inProgressLabel:En curso`,
      COMPLETED: $localize`:@@completedLabel:Completado`,
      CANCELLED: $localize`:@@cancelledLabel:Cancelado`,
      ARCHIVED: $localize`:@@archivedLabel:Archivado`
    };
    return labels[status];
  }

  dateLabel(value: string): string {
    const organization = this.organizationService.activeOrganization();
    return formatRegionalDate(value, {
      dateFormat: organization?.dateFormat ?? "dd-MM-yyyy",
      numberFormat: organization?.numberFormat ?? "es"
    });
  }

  moneyLabel(value: string, currency: string): string {
    const organization = this.organizationService.activeOrganization();
    return formatRegionalCurrency(value, { currency, numberFormat: organization?.numberFormat ?? "es" });
  }
}
