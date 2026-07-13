import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { Client } from "../clients/client.models";
import { ClientsService } from "../clients/clients.service";
import { EventPayload } from "../events/event.models";
import { EventsService } from "../events/events.service";
import { OrganizationService } from "../organizations/organization.service";
import { Quotation } from "../quotations/quotation.models";
import { QuotationsService } from "../quotations/quotations.service";
import { NotificationService } from "../shared/notifications/notification.service";

@Component({
  selector: "kaklen-event-form",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <main class="auth-shell">
      <section class="auth-card wide-card">
        <p class="eyebrow" i18n="@@eventsEyebrow">Eventos</p>
        <h1>{{ eventId ? editTitle : createTitle }}</h1>
        <p i18n="@@eventFormDescription">Define fechas, cliente, lugar y presupuesto operativo.</p>

        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="field-grid">
            <label>
              <span i18n="@@nameLabel">Nombre</span>
              <input formControlName="name" required />
            </label>
            <label>
              <span i18n="@@clientLabel">Cliente</span>
              <select formControlName="clientId">
                <option value="" i18n="@@noClientLabel">Sin cliente</option>
                <option *ngFor="let client of clients()" [value]="client.id">{{ client.displayName }}</option>
              </select>
            </label>
            <label>
              <span i18n="@@approvedQuotationLabel">Cotización aprobada</span>
              <select formControlName="quotationId">
                <option value="" i18n="@@noneOption">Ninguna</option>
                <option *ngFor="let quotation of approvedQuotations()" [value]="quotation.id">{{ quotation.number }} · {{ quotation.client.displayName }}</option>
              </select>
            </label>
            <label>
              <span i18n="@@startAtLabel">Inicio</span>
              <input type="datetime-local" formControlName="startAt" required />
            </label>
            <label>
              <span i18n="@@endAtLabel">Término</span>
              <input type="datetime-local" formControlName="endAt" required />
            </label>
            <label>
              <span i18n="@@timezoneLabel">Zona horaria</span>
              <input formControlName="timezone" />
            </label>
            <label>
              <span i18n="@@venueNameLabel">Lugar</span>
              <input formControlName="venueName" />
            </label>
            <label>
              <span i18n="@@cityLabel">Ciudad</span>
              <input formControlName="city" />
            </label>
            <label>
              <span i18n="@@regionLabel">Región</span>
              <input formControlName="region" />
            </label>
            <label>
              <span i18n="@@currencyLabel">Moneda</span>
              <input formControlName="currency" maxlength="3" />
            </label>
            <label>
              <span i18n="@@budgetLabel">Presupuesto</span>
              <input type="number" min="0" step="0.01" formControlName="budget" />
            </label>
            <label>
              <span i18n="@@contactNameLabel">Contacto</span>
              <input formControlName="contactName" />
            </label>
            <label>
              <span i18n="@@contactEmailLabel">Email contacto</span>
              <input type="email" formControlName="contactEmail" />
            </label>
            <label>
              <span i18n="@@contactPhoneLabel">Teléfono contacto</span>
              <input formControlName="contactPhone" />
            </label>
          </div>
          <label>
            <span i18n="@@descriptionLabel">Descripción</span>
            <textarea formControlName="description" rows="3"></textarea>
          </label>
          <label>
            <span i18n="@@notesLabel">Notas</span>
            <textarea formControlName="notes" rows="3"></textarea>
          </label>
          <p class="form-error" *ngIf="error()">{{ error() }}</p>
          <div class="row-actions">
            <button type="submit" [disabled]="loading() || form.invalid">
              {{ loading() ? savingLabel : saveChangesLabel }}
            </button>
            <button type="button" class="secondary" (click)="back()" i18n="@@cancelButton">Cancelar</button>
          </div>
        </form>
      </section>
    </main>
  `
})
export class EventFormComponent implements OnInit {
  readonly loading = signal(false);
  readonly error = signal("");
  readonly clients = signal<Client[]>([]);
  readonly approvedQuotations = signal<Quotation[]>([]);
  readonly createTitle = $localize`:@@createEventTitle:Nuevo evento`;
  readonly editTitle = $localize`:@@editEventTitle:Editar evento`;
  readonly saveChangesLabel = $localize`:@@saveChangesButton:Guardar cambios`;
  readonly savingLabel = $localize`:@@savingButton:Guardando...`;
  organizationId = "";
  eventId = "";
  readonly form = new FormGroup({
    clientId: new FormControl("", { nonNullable: true }),
    quotationId: new FormControl("", { nonNullable: true }),
    name: new FormControl("", { nonNullable: true, validators: [Validators.required, Validators.maxLength(160)] }),
    description: new FormControl("", { nonNullable: true }),
    startAt: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    endAt: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    timezone: new FormControl("", { nonNullable: true }),
    venueName: new FormControl("", { nonNullable: true }),
    city: new FormControl("", { nonNullable: true }),
    region: new FormControl("", { nonNullable: true }),
    currency: new FormControl("", { nonNullable: true }),
    budget: new FormControl<number | null>(null),
    contactName: new FormControl("", { nonNullable: true }),
    contactEmail: new FormControl("", { nonNullable: true }),
    contactPhone: new FormControl("", { nonNullable: true }),
    notes: new FormControl("", { nonNullable: true })
  });

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly organizationService: OrganizationService,
    private readonly clientsService: ClientsService,
    private readonly quotationsService: QuotationsService,
    private readonly eventsService: EventsService,
    private readonly notifications: NotificationService
  ) {}

  async ngOnInit(): Promise<void> {
    this.organizationId = this.route.snapshot.paramMap.get("organizationId") ?? "";
    this.eventId = this.route.snapshot.paramMap.get("eventId") ?? "";
    await this.organizationService.setActiveOrganization(this.organizationId);
    const organization = this.organizationService.activeOrganization();
    this.form.patchValue({ timezone: organization?.timezone ?? "America/Santiago", currency: organization?.currency ?? "CLP" });
    await this.loadOptions();
    const quotationId = this.route.snapshot.queryParamMap.get("quotationId");
    if (quotationId) {
      this.form.controls.quotationId.setValue(quotationId);
    }
    if (this.eventId) {
      const event = await this.eventsService.get(this.organizationId, this.eventId);
      this.form.patchValue({
        clientId: event.clientId ?? "",
        quotationId: event.quotationId ?? "",
        name: event.name,
        description: event.description ?? "",
        startAt: this.toLocalInput(event.startAt),
        endAt: this.toLocalInput(event.endAt),
        timezone: event.timezone,
        venueName: event.venueName ?? "",
        city: event.city ?? "",
        region: event.region ?? "",
        currency: event.currency,
        budget: event.budget ? Number(event.budget) : null,
        contactName: event.contactName ?? "",
        contactEmail: event.contactEmail ?? "",
        contactPhone: event.contactPhone ?? "",
        notes: event.notes ?? ""
      });
    }
  }

  async save(): Promise<void> {
    this.loading.set(true);
    this.error.set("");
    try {
      const payload = this.payload();
      const quotationId = this.form.getRawValue().quotationId;
      const event = this.eventId
        ? await this.eventsService.update(this.organizationId, this.eventId, payload)
        : quotationId
          ? await this.eventsService.createFromQuotation(this.organizationId, quotationId, payload)
          : await this.eventsService.create(this.organizationId, payload);
      this.notifications.success(
        this.eventId
          ? $localize`:@@eventUpdatedSuccess:Evento actualizado correctamente.`
          : $localize`:@@eventCreatedSuccess:Evento creado correctamente.`
      );
      await this.router.navigate(["/organizations", this.organizationId, "events", event.id]);
    } catch (error) {
      this.notifications.fromError(error);
      this.error.set($localize`:@@eventSaveError:No fue posible guardar el evento.`);
    } finally {
      this.loading.set(false);
    }
  }

  back(): void {
    void this.router.navigate(["/organizations", this.organizationId, "events"]);
  }

  private async loadOptions(): Promise<void> {
    const [clients, quotations] = await Promise.all([
      this.clientsService.list(this.organizationId, { pageSize: 100 }),
      this.quotationsService.list(this.organizationId, { status: "APPROVED", pageSize: 100 })
    ]);
    this.clients.set(clients.items);
    this.approvedQuotations.set(quotations.items);
  }

  private payload(): EventPayload {
    const value = this.form.getRawValue();
    return {
      clientId: value.clientId || null,
      quotationId: value.quotationId || undefined,
      name: value.name,
      description: value.description || null,
      startAt: new Date(value.startAt).toISOString(),
      endAt: new Date(value.endAt).toISOString(),
      timezone: value.timezone,
      venueName: value.venueName || null,
      city: value.city || null,
      region: value.region || null,
      currency: value.currency,
      budget: value.budget,
      contactName: value.contactName || null,
      contactEmail: value.contactEmail || null,
      contactPhone: value.contactPhone || null,
      notes: value.notes || null
    };
  }

  private toLocalInput(value: string): string {
    return new Date(value).toISOString().slice(0, 16);
  }
}
