import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, provideRouter, Router } from "@angular/router";
import { EventsService } from "../events/events.service";
import { OrganizationService } from "../organizations/organization.service";
import { EventCalendarComponent } from "./event-calendar.component";

describe("EventCalendarComponent", () => {
  let fixture: ComponentFixture<EventCalendarComponent>;
  let router: Router;
  const organizationId = "organization-1";
  const eventId = "event-1";
  const start = new Date();
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventCalendarComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => organizationId } } }
        },
        {
          provide: OrganizationService,
          useValue: {
            setActiveOrganization: () => Promise.resolve(),
            activeOrganization: () => ({ numberFormat: "es", dateFormat: "dd-MM-yyyy" })
          }
        },
        {
          provide: EventsService,
          useValue: {
            calendar: () => Promise.resolve([{
              id: eventId,
              code: "EVT-001",
              name: "Lanzamiento",
              startAt: start.toISOString(),
              endAt: end.toISOString(),
              status: "CONFIRMED",
              city: "Santiago",
              venueName: null,
              client: { id: "client-1", displayName: "Cliente Demo" }
            }])
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(EventCalendarComponent);
    router = TestBed.inject(Router);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it("renders the weekly event as a fully described detail link", () => {
    const link = fixture.nativeElement.querySelector(".weekly-event-link") as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute("href")).toBe(`/organizations/${organizationId}/events/${eventId}`);
    expect(link.getAttribute("aria-label")).toContain("Lanzamiento");
    expect(link.textContent).toContain("EVT-001 · Lanzamiento");
    expect(link.textContent).toContain("Cliente Demo");
    expect(link.textContent).toContain("Santiago");
  });

  it("opens the event with Space and prevents page scrolling", () => {
    const navigation = spyOn(router, "navigate").and.resolveTo(true);
    const event = new KeyboardEvent("keydown", { key: " ", cancelable: true });

    fixture.componentInstance.openWeeklyEvent(eventId, event);

    expect(event.defaultPrevented).toBeTrue();
    expect(navigation).toHaveBeenCalledOnceWith(["/organizations", organizationId, "events", eventId]);
  });
});
