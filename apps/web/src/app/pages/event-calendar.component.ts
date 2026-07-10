import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { CalendarEvent } from "../events/event.models";
import { EventsService } from "../events/events.service";
import { formatRegionalDate } from "../i18n/formatting";
import { OrganizationService } from "../organizations/organization.service";

interface CalendarDay {
  date: Date;
  inMonth: boolean;
  events: CalendarEvent[];
}

@Component({
  selector: "kaklen-event-calendar",
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <main class="dashboard-shell">
      <section class="dashboard-header">
        <div>
          <p class="eyebrow" i18n="@@eventCalendarEyebrow">Calendario</p>
          <h1 i18n="@@eventCalendarTitle">Calendario de eventos</h1>
          <p>{{ monthLabel() }}</p>
        </div>
        <div class="row-actions">
          <button type="button" class="secondary" (click)="moveMonth(-1)" i18n="@@previousPageButton">Anterior</button>
          <button type="button" class="secondary" (click)="moveMonth(1)" i18n="@@nextPageButton">Siguiente</button>
          <a class="button-link" [routerLink]="['/organizations', organizationId, 'events']" i18n="@@backToListButton">Volver al listado</a>
        </div>
      </section>

      <p class="form-error" *ngIf="error()">{{ error() }}</p>

      <section class="calendar-grid" aria-label="Calendario de eventos" i18n-aria-label="@@eventCalendarAriaLabel">
        <article class="calendar-day" *ngFor="let day of days()" [class.muted]="!day.inMonth">
          <strong>{{ day.date.getDate() }}</strong>
          <a *ngFor="let event of day.events" [routerLink]="['/organizations', organizationId, 'events', event.id]">
            {{ event.code }} · {{ event.name }}
            <small>{{ event.city || event.venueName || "" }}</small>
          </a>
        </article>
      </section>

      <section class="dashboard-panel">
        <h2 i18n="@@weeklyViewTitle">Vista semanal</h2>
        <article class="item-row" *ngFor="let event of weekEvents()">
          <span><strong>{{ event.name }}</strong><small>{{ dateLabel(event.startAt) }} · {{ event.client?.displayName || noClientLabel }}</small></span>
        </article>
      </section>
    </main>
  `,
  styles: [
    `
      .calendar-grid {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 0.5rem;
      }
      .calendar-day {
        min-height: 8rem;
        border: 1px solid #d8dee9;
        border-radius: 0.5rem;
        padding: 0.75rem;
        background: #fff;
      }
      .calendar-day.muted {
        opacity: 0.55;
      }
      .calendar-day a {
        display: block;
        margin-top: 0.5rem;
        font-size: 0.875rem;
      }
      .calendar-day small {
        display: block;
      }
      @media (max-width: 760px) {
        .calendar-grid {
          grid-template-columns: 1fr;
        }
        .calendar-day {
          min-height: auto;
        }
      }
    `
  ]
})
export class EventCalendarComponent implements OnInit {
  readonly days = signal<CalendarDay[]>([]);
  readonly weekEvents = signal<CalendarEvent[]>([]);
  readonly error = signal("");
  readonly noClientLabel = $localize`:@@noClientLabel:Sin cliente`;
  organizationId = "";
  current = new Date();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly organizationService: OrganizationService,
    private readonly eventsService: EventsService
  ) {}

  async ngOnInit(): Promise<void> {
    this.organizationId = this.route.snapshot.paramMap.get("organizationId") ?? "";
    await this.organizationService.setActiveOrganization(this.organizationId);
    await this.load();
  }

  async moveMonth(delta: number): Promise<void> {
    this.current = new Date(this.current.getFullYear(), this.current.getMonth() + delta, 1);
    await this.load();
  }

  monthLabel(): string {
    return this.current.toLocaleDateString(this.organizationService.activeOrganization()?.numberFormat ?? "es", {
      month: "long",
      year: "numeric"
    });
  }

  dateLabel(value: string): string {
    const organization = this.organizationService.activeOrganization();
    return formatRegionalDate(value, {
      dateFormat: organization?.dateFormat ?? "dd-MM-yyyy",
      numberFormat: organization?.numberFormat ?? "es"
    });
  }

  private async load(): Promise<void> {
    this.error.set("");
    try {
      const first = new Date(this.current.getFullYear(), this.current.getMonth(), 1);
      const gridStart = new Date(first);
      gridStart.setDate(first.getDate() - first.getDay());
      const gridEnd = new Date(gridStart);
      gridEnd.setDate(gridStart.getDate() + 41);
      const events = await this.eventsService.calendar(this.organizationId, gridStart.toISOString(), gridEnd.toISOString());
      const days = Array.from({ length: 42 }, (_, index) => {
        const date = new Date(gridStart);
        date.setDate(gridStart.getDate() + index);
        return {
          date,
          inMonth: date.getMonth() === this.current.getMonth(),
          events: events.filter((event) => this.sameDay(new Date(event.startAt), date))
        };
      });
      this.days.set(days);
      this.weekEvents.set(events.filter((event) => this.inCurrentWeek(new Date(event.startAt))));
    } catch {
      this.error.set($localize`:@@eventCalendarLoadError:No fue posible cargar el calendario.`);
    }
  }

  private sameDay(left: Date, right: Date): boolean {
    return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
  }

  private inCurrentWeek(value: Date): boolean {
    const start = new Date();
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return value >= start && value < end;
  }
}
