import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Event, EventParticipantRole, EventStatus, EventTaskPriority, EventTaskStatus } from "../events/event.models";
import { EventsService } from "../events/events.service";
import {
  eventParticipantRoleLabel,
  eventStatusLabel,
  eventTaskPriorityLabel,
  eventTaskStatusLabel
} from "../i18n/display-labels";
import { formatRegionalCurrency, formatRegionalDate } from "../i18n/formatting";
import { OrganizationService } from "../organizations/organization.service";
import { NotificationService } from "../shared/notifications/notification.service";
import { ConfirmationDialogComponent } from "../shared/confirmation-dialog.component";
import { ActionMenuComponent, ActionMenuItemDirective } from "../shared/action-menu.component";
import { UiIconComponent } from "../shared/ui-icon.component";
import { atLeastOneValidator, decimalValidator, emailValidator, normalizeEmail, trimmedRequired } from "../shared/forms/form-validators";
import { FieldErrorComponent, FormControlA11yDirective, FormErrorSummaryComponent,   FormFieldComponent
} from "../shared/forms/form-feedback.components";

@Component({
  selector: "kaklen-event-detail",
  standalone: true,
  imports: [FormFieldComponent, CommonModule, ReactiveFormsModule, RouterLink, ConfirmationDialogComponent, ActionMenuComponent, ActionMenuItemDirective, UiIconComponent, FieldErrorComponent, FormControlA11yDirective, FormErrorSummaryComponent],
  template: `
    <main class="dashboard-shell" *ngIf="event() as item">
      <section class="dashboard-header">
        <div>
          <p class="eyebrow" i18n="@@eventsEyebrow">Eventos</p>
          <h1>{{ item.code }} · {{ item.name }}</h1>
          <p>{{ statusLabel(item.status) }} · {{ dateLabel(item.startAt) }} - {{ dateLabel(item.endAt) }}</p>
        </div>
        <div class="row-actions">
          <a class="ghost button-link" [routerLink]="['/organizations', organizationId, 'events']"><kaklen-icon name="arrow-left" /><span i18n="@@backToListButton">Volver al listado</span></a>
          <a *ngIf="canUpdate()" class="button-link" [routerLink]="['/organizations', organizationId, 'events', item.id, 'edit']"><kaklen-icon name="pencil" /><span i18n="@@editLink">Editar</span></a>
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
          <button *ngIf="item.status === 'DRAFT'" type="button" class="success" (click)="changeStatus('confirm')" [disabled]="processing()"><kaklen-icon name="check-circle" /><span i18n="@@confirmButton">Confirmar</span></button>
          <button *ngIf="item.status === 'CONFIRMED'" type="button" (click)="changeStatus('start')" [disabled]="processing()"><kaklen-icon name="play" /><span i18n="@@startEventButton">Iniciar</span></button>
          <button *ngIf="item.status === 'IN_PROGRESS'" type="button" class="success" (click)="changeStatus('complete')" [disabled]="processing()"><kaklen-icon name="flag" /><span i18n="@@completeButton">Completar</span></button>
          <kaklen-action-menu *ngIf="canShowEventMenu(item.status)" [contextKey]="organizationId">
            <button *ngIf="canCancel(item.status)" kaklenMenuItem type="button" class="danger" (click)="pendingDestructiveAction.set('cancel')" [disabled]="processing()"><kaklen-icon name="x-circle" /><span i18n="@@cancelButton">Cancelar</span></button>
            <button *ngIf="canDelete()" kaklenMenuItem type="button" class="danger" (click)="pendingDestructiveAction.set('archive')" [disabled]="processing()"><kaklen-icon name="archive" /><span i18n="@@archiveButton">Archivar</span></button>
          </kaklen-action-menu>
        </div>
      </section>

      <p class="form-error" *ngIf="error()">{{ error() }}</p>

      <section class="dashboard-panel">
        <h2 i18n="@@tasksTitle">Tareas</h2>
        <form [formGroup]="taskForm" (ngSubmit)="addTask()">
          <kaklen-form-error-summary [form]="taskForm" [attempted]="taskSubmitted()" [labels]="taskFieldLabels" />
          <div class="field-grid">
            <label kaklen-form-field label="Título" i18n-label="@@titleLabel" controlId="event-detail-title" required="auto" invalid="auto">
              <input kaklenControl formControlName="title" maxlength="160" aria-required="true" aria-describedby="event-task-title-error" />
              <kaklen-field-error id="event-task-title-error" [control]="taskForm.controls.title" [attempted]="taskSubmitted()" />
            </label>
            <label kaklen-form-field label="Prioridad" i18n-label="@@priorityLabel" controlId="event-detail-priority" required="auto" invalid="auto">
              <select kaklenControl formControlName="priority">
                <option value="LOW" i18n="@@lowPriorityLabel">Baja</option>
                <option value="MEDIUM" i18n="@@mediumPriorityLabel">Media</option>
                <option value="HIGH" i18n="@@highPriorityLabel">Alta</option>
                <option value="URGENT" i18n="@@urgentPriorityLabel">Urgente</option>
              </select>
            </label>
          </div>
          <button type="submit" [disabled]="formSaving() || !canUpdate()"><kaklen-icon name="plus" /><span i18n="@@addTaskButton">Agregar tarea</span></button>
        </form>
        <article class="item-row" *ngFor="let task of item.tasks">
          <span><strong>{{ task.title }}</strong><small>{{ taskStatusLabel(task.status) }} · {{ taskPriorityLabel(task.priority) }}</small></span>
          <button type="button" class="success" (click)="completeTask(task.id, task.title)" [disabled]="task.status === 'COMPLETED' || !canUpdate()"><kaklen-icon name="check" /><span i18n="@@completeButton">Completar</span></button>
        </article>
      </section>

      <section class="dashboard-panel">
        <h2 i18n="@@participantsTitle">Participantes</h2>
        <form [formGroup]="participantForm" (ngSubmit)="addParticipant()">
          <kaklen-form-error-summary [form]="participantForm" [attempted]="participantSubmitted()" [labels]="participantFieldLabels" />
          <p class="field-error" *ngIf="participantSubmitted() && participantForm.hasError('atLeastOne')" role="alert" i18n="@@participantIdentityRequired">Ingresa el nombre o el email del participante.</p>
          <div class="field-grid">
            <label kaklen-form-field label="Nombre" i18n-label="@@nameLabel" controlId="event-detail-externalName" required="auto" invalid="auto">
              <input kaklenControl formControlName="externalName" maxlength="160" />
            </label>
            <label kaklen-form-field label="Email" i18n-label="@@emailLabel" controlId="event-detail-externalEmail" required="auto" invalid="auto">
              <input kaklenControl type="email" inputmode="email" formControlName="externalEmail" maxlength="160" aria-describedby="event-participant-email-error" />
              <kaklen-field-error id="event-participant-email-error" [control]="participantForm.controls.externalEmail" [attempted]="participantSubmitted()" />
            </label>
            <label kaklen-form-field label="Rol" i18n-label="@@roleLabel" controlId="event-detail-role" required="auto" invalid="auto">
              <select kaklenControl formControlName="role">
                <option value="CLIENT_CONTACT" i18n="@@clientContactRoleLabel">Contacto del cliente</option>
                <option value="COORDINATOR" i18n="@@coordinatorRoleLabel">Coordinador</option>
                <option value="STAFF" i18n="@@staffRoleLabel">Equipo</option>
                <option value="SUPPLIER" i18n="@@supplierRoleLabel">Proveedor</option>
                <option value="GUEST" i18n="@@guestRoleLabel">Invitado</option>
              </select>
            </label>
          </div>
          <button type="submit" [disabled]="formSaving() || !canUpdate()"><kaklen-icon name="plus" /><span i18n="@@addParticipantButton">Agregar participante</span></button>
        </form>
        <article class="item-row" *ngFor="let participant of item.participants">
          <span><strong>{{ participant.externalName || participant.externalEmail || participantRoleLabel(participant.role) }}</strong><small>{{ participantRoleLabel(participant.role) }}</small></span>
        </article>
      </section>

      <section class="dashboard-panel">
        <h2 i18n="@@resourcesTitle">Recursos</h2>
        <form [formGroup]="resourceForm" (ngSubmit)="addResource()">
          <kaklen-form-error-summary [form]="resourceForm" [attempted]="resourceSubmitted()" [labels]="resourceFieldLabels" />
          <div class="field-grid">
            <label kaklen-form-field label="Nombre" i18n-label="@@nameLabel" controlId="event-detail-name" required="auto" invalid="auto">
              <input kaklenControl formControlName="name" maxlength="160" aria-required="true" aria-describedby="event-resource-name-error" />
              <kaklen-field-error id="event-resource-name-error" [control]="resourceForm.controls.name" [attempted]="resourceSubmitted()" />
            </label>
            <label kaklen-form-field label="Cantidad" i18n-label="@@quantityLabel" controlId="event-detail-quantity" required="auto" invalid="auto">
              <input kaklenControl type="number" inputmode="decimal" min="0.001" step="0.001" formControlName="quantity" aria-required="true" aria-describedby="event-resource-quantity-error" />
              <kaklen-field-error id="event-resource-quantity-error" [control]="resourceForm.controls.quantity" [attempted]="resourceSubmitted()" />
            </label>
            <label kaklen-form-field label="Unidad" i18n-label="@@unitLabel" controlId="event-detail-unit" required="auto" invalid="auto">
              <input kaklenControl formControlName="unit" maxlength="40" aria-required="true" aria-describedby="event-resource-unit-error" />
              <kaklen-field-error id="event-resource-unit-error" [control]="resourceForm.controls.unit" [attempted]="resourceSubmitted()" />
            </label>
          </div>
          <button type="submit" [disabled]="formSaving() || !canUpdate()"><kaklen-icon name="plus" /><span i18n="@@addResourceButton">Agregar recurso</span></button>
        </form>
        <article class="item-row" *ngFor="let resource of item.resources">
          <span><strong>{{ resource.name }}</strong><small>{{ resource.quantity }} {{ resource.unit }}</small></span>
        </article>
      </section>

      <section class="dashboard-panel">
        <h2 i18n="@@timelineTitle">Cronograma</h2>
        <form [formGroup]="timelineForm" (ngSubmit)="addTimelineEntry()">
          <kaklen-form-error-summary [form]="timelineForm" [attempted]="timelineSubmitted()" [labels]="timelineFieldLabels" />
          <div class="field-grid">
            <label kaklen-form-field label="Título" i18n-label="@@titleLabel" controlId="event-detail-title-2" required="auto" invalid="auto">
              <input kaklenControl formControlName="title" maxlength="160" aria-required="true" aria-describedby="event-timeline-title-error" />
              <kaklen-field-error id="event-timeline-title-error" [control]="timelineForm.controls.title" [attempted]="timelineSubmitted()" />
            </label>
            <label kaklen-form-field label="Inicio" i18n-label="@@startAtLabel" controlId="event-detail-startsAt" required="auto" invalid="auto">
              <input kaklenControl type="datetime-local" formControlName="startsAt" aria-required="true" aria-describedby="event-timeline-start-error" />
              <kaklen-field-error id="event-timeline-start-error" [control]="timelineForm.controls.startsAt" [attempted]="timelineSubmitted()" />
            </label>
          </div>
          <button type="submit" [disabled]="formSaving() || !canUpdate()"><kaklen-icon name="plus" /><span i18n="@@addTimelineEntryButton">Agregar al cronograma</span></button>
        </form>
        <article class="item-row" *ngFor="let entry of item.timeline">
          <span><strong>{{ entry.title }}</strong><small>{{ dateLabel(entry.startsAt) }}</small></span>
        </article>
      </section>
      <kaklen-confirmation-dialog
        [open]="pendingDestructiveAction() !== null"
        [busy]="processing()"
        [title]="destructiveDialogTitle()"
        [description]="destructiveDialogDescription()"
        [confirmLabel]="destructiveDialogAction()"
        (confirm)="confirmDestructiveAction()"
        (cancel)="pendingDestructiveAction.set(null)"
      />
    </main>
  `
})
export class EventDetailComponent implements OnInit {
  readonly event = signal<Event | null>(null);
  readonly error = signal("");
  readonly processing = signal(false);
  readonly formSaving = signal(false);
  readonly taskSubmitted = signal(false);
  readonly participantSubmitted = signal(false);
  readonly resourceSubmitted = signal(false);
  readonly timelineSubmitted = signal(false);
  readonly pendingDestructiveAction = signal<"cancel" | "archive" | null>(null);
  readonly noClientLabel = $localize`:@@noClientLabel:Sin cliente`;
  readonly noVenueLabel = $localize`:@@noVenueLabel:Sin lugar`;
  readonly noCityLabel = $localize`:@@noCityLabel:Sin ciudad`;
  readonly noBudgetLabel = $localize`:@@noBudgetLabel:Sin presupuesto`;
  readonly taskFieldLabels = { title: $localize`:@@titleLabel:Título`, priority: $localize`:@@priorityLabel:Prioridad` };
  readonly participantFieldLabels = { externalName: $localize`:@@nameLabel:Nombre`, externalEmail: $localize`:@@emailLabel:Email`, role: $localize`:@@roleLabel:Rol` };
  readonly resourceFieldLabels = { name: $localize`:@@nameLabel:Nombre`, quantity: $localize`:@@quantityLabel:Cantidad`, unit: $localize`:@@unitLabel:Unidad` };
  readonly timelineFieldLabels = { title: $localize`:@@titleLabel:Título`, startsAt: $localize`:@@startAtLabel:Inicio` };
  organizationId = "";
  eventId = "";
  readonly taskForm = new FormGroup({
    title: new FormControl("", { nonNullable: true, validators: [Validators.required, trimmedRequired(), Validators.maxLength(160)] }),
    priority: new FormControl<EventTaskPriority>("MEDIUM", { nonNullable: true })
  });
  readonly participantForm = new FormGroup({
    externalName: new FormControl("", { nonNullable: true, validators: [Validators.maxLength(160)] }),
    externalEmail: new FormControl("", { nonNullable: true, validators: [emailValidator(), Validators.maxLength(160)] }),
    role: new FormControl<EventParticipantRole>("CLIENT_CONTACT", { nonNullable: true })
  }, atLeastOneValidator(["externalName", "externalEmail"]));
  readonly resourceForm = new FormGroup({
    name: new FormControl("", { nonNullable: true, validators: [Validators.required, trimmedRequired(), Validators.maxLength(160)] }),
    quantity: new FormControl(1, { nonNullable: true, validators: [Validators.required, decimalValidator(0.001, 999_999_999.999, 3)] }),
    unit: new FormControl("unidad", { nonNullable: true, validators: [Validators.required, trimmedRequired(), Validators.maxLength(40)] })
  });
  readonly timelineForm = new FormGroup({
    title: new FormControl("", { nonNullable: true, validators: [Validators.required, trimmedRequired(), Validators.maxLength(160)] }),
    startsAt: new FormControl("", { nonNullable: true, validators: [Validators.required] })
  });

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly organizationService: OrganizationService,
    private readonly eventsService: EventsService,
    private readonly notifications: NotificationService
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

  canCancel(status: EventStatus): boolean {
    return status === "DRAFT" || status === "CONFIRMED" || status === "IN_PROGRESS";
  }

  canShowEventMenu(status: EventStatus): boolean {
    return this.canCancel(status) || this.canDelete();
  }

  async load(): Promise<void> {
    this.event.set(await this.eventsService.get(this.organizationId, this.eventId));
  }

  async changeStatus(action: "confirm" | "start" | "complete" | "cancel"): Promise<void> {
    if (this.processing()) {
      return;
    }
    this.processing.set(true);
    try {
      this.event.set(await this.eventsService.changeStatus(this.organizationId, this.eventId, action));
      this.notifications.success(this.statusSuccessMessage(action));
      this.pendingDestructiveAction.set(null);
    } catch (error) {
      this.notifications.fromError(error);
      this.error.set($localize`:@@eventStatusError:No fue posible cambiar el estado del evento.`);
    } finally {
      this.processing.set(false);
    }
  }

  async archive(): Promise<void> {
    if (this.processing()) {
      return;
    }
    this.processing.set(true);
    try {
      await this.eventsService.archive(this.organizationId, this.eventId);
      this.pendingDestructiveAction.set(null);
      this.notifications.success($localize`:@@eventArchivedSuccess:Evento archivado.`);
      await this.router.navigate(["/organizations", this.organizationId, "events"]);
    } catch (error) {
      this.notifications.fromError(error);
    } finally {
      this.processing.set(false);
    }
  }

  confirmDestructiveAction(): void {
    if (this.pendingDestructiveAction() === "cancel") {
      void this.changeStatus("cancel");
    } else if (this.pendingDestructiveAction() === "archive") {
      void this.archive();
    }
  }

  destructiveDialogTitle(): string {
    return this.pendingDestructiveAction() === "archive"
      ? $localize`:@@archiveEventDialogTitle:Archivar evento`
      : $localize`:@@cancelEventDialogTitle:Cancelar evento`;
  }

  destructiveDialogDescription(): string {
    return this.pendingDestructiveAction() === "archive"
      ? $localize`:@@archiveEventDialogDescription:El evento dejará de aparecer en la operación activa, pero su información histórica se conservará.`
      : $localize`:@@cancelEventDialogDescription:El evento quedará cancelado y no podrá continuar a las etapas de ejecución.`;
  }

  destructiveDialogAction(): string {
    return this.pendingDestructiveAction() === "archive"
      ? $localize`:@@archiveButton:Archivar`
      : $localize`:@@cancelDefinitelyButton:Cancelar definitivamente`;
  }

  async addTask(): Promise<void> {
    this.taskSubmitted.set(true);
    this.taskForm.markAllAsTouched();
    if (this.taskForm.invalid || this.formSaving()) { this.focusFirstInvalid(this.taskForm, "title"); return; }
    this.formSaving.set(true);
    try {
      const value = this.taskForm.getRawValue();
      await this.eventsService.createTask(this.organizationId, this.eventId, { ...value, title: value.title.trim() });
      this.notifications.success($localize`:@@eventTaskAddedSuccess:Tarea agregada correctamente.`);
      this.taskForm.reset({ title: "", priority: "MEDIUM" });
      this.taskSubmitted.set(false);
      await this.load();
    } catch (error) {
      this.notifications.fromError(error);
    } finally {
      this.formSaving.set(false);
    }
  }

  async completeTask(taskId: string, title: string): Promise<void> {
    await this.eventsService.updateTask(this.organizationId, this.eventId, taskId, { title, status: "COMPLETED" });
    this.notifications.success($localize`:@@eventTaskCompletedSuccess:Tarea completada.`);
    await this.load();
  }

  async addParticipant(): Promise<void> {
    this.participantSubmitted.set(true);
    this.participantForm.markAllAsTouched();
    if (this.participantForm.invalid || this.formSaving()) { this.focusFirstInvalid(this.participantForm, "externalName"); return; }
    this.formSaving.set(true);
    try {
      const value = this.participantForm.getRawValue();
      await this.eventsService.createParticipant(this.organizationId, this.eventId, {
        ...value,
        externalName: value.externalName.trim() || undefined,
        externalEmail: normalizeEmail(value.externalEmail) || undefined
      });
      this.notifications.success($localize`:@@eventParticipantAddedSuccess:Participante agregado correctamente.`);
      this.participantForm.reset({ externalName: "", externalEmail: "", role: "CLIENT_CONTACT" });
      this.participantSubmitted.set(false);
      await this.load();
    } catch (error) {
      this.notifications.fromError(error);
    } finally {
      this.formSaving.set(false);
    }
  }

  async addResource(): Promise<void> {
    this.resourceSubmitted.set(true);
    this.resourceForm.markAllAsTouched();
    if (this.resourceForm.invalid || this.formSaving()) { this.focusFirstInvalid(this.resourceForm, "name"); return; }
    this.formSaving.set(true);
    try {
      const value = this.resourceForm.getRawValue();
      await this.eventsService.createResource(this.organizationId, this.eventId, { ...value, name: value.name.trim(), unit: value.unit.trim() });
      this.notifications.success($localize`:@@eventResourceAddedSuccess:Recurso agregado correctamente.`);
      this.resourceForm.reset({ name: "", quantity: 1, unit: "unidad" });
      this.resourceSubmitted.set(false);
      await this.load();
    } catch (error) {
      this.notifications.fromError(error);
    } finally {
      this.formSaving.set(false);
    }
  }

  async addTimelineEntry(): Promise<void> {
    this.timelineSubmitted.set(true);
    this.timelineForm.markAllAsTouched();
    if (this.timelineForm.invalid || this.formSaving()) { this.focusFirstInvalid(this.timelineForm, "title"); return; }
    this.formSaving.set(true);
    const value = this.timelineForm.getRawValue();
    try {
      await this.eventsService.createTimelineEntry(this.organizationId, this.eventId, {
        title: value.title.trim(),
        startsAt: new Date(value.startsAt).toISOString()
      });
      this.notifications.success($localize`:@@eventTimelineAddedSuccess:Cronograma actualizado correctamente.`);
      this.timelineForm.reset({ title: "", startsAt: "" });
      this.timelineSubmitted.set(false);
      await this.load();
    } catch (error) {
      this.notifications.fromError(error);
    } finally {
      this.formSaving.set(false);
    }
  }

  statusLabel(status: EventStatus): string {
    return eventStatusLabel(status);
  }

  taskStatusLabel(status: EventTaskStatus): string {
    return eventTaskStatusLabel(status);
  }

  taskPriorityLabel(priority: EventTaskPriority): string {
    return eventTaskPriorityLabel(priority);
  }

  participantRoleLabel(role: EventParticipantRole): string {
    return eventParticipantRoleLabel(role);
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

  private statusSuccessMessage(action: "confirm" | "start" | "complete" | "cancel"): string {
    const messages: Record<typeof action, string> = {
      confirm: $localize`:@@eventConfirmedSuccess:Evento confirmado.`,
      start: $localize`:@@eventStartedSuccess:Evento iniciado.`,
      complete: $localize`:@@eventCompletedSuccess:Evento completado.`,
      cancel: $localize`:@@eventCancelledSuccess:Evento cancelado.`
    };
    return messages[action];
  }

  private focusFirstInvalid(form: FormGroup, fallbackControl: string): void {
    const firstInvalid = Object.entries(form.controls).find(([, control]) => control.invalid)?.[0] ?? fallbackControl;
    window.setTimeout(() => document.querySelector<HTMLElement>(`[formControlName="${firstInvalid}"]`)?.focus(), 0);
  }
}
