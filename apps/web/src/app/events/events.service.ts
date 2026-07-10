import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import {
  CalendarEvent,
  Event,
  EventParticipant,
  EventParticipantRole,
  EventResource,
  EventTask,
  EventTaskPriority,
  EventTimelineEntry,
  EventPayload,
  EventSummary,
  PaginatedEvents
} from "./event.models";

const API_URL = "http://localhost:3000/api";

interface EventTaskPayload {
  title: string;
  description?: string | null;
  status?: string;
  priority?: EventTaskPriority;
  assignedUserId?: string | null;
  dueAt?: string | null;
}

interface EventParticipantPayload {
  userId?: string;
  clientId?: string;
  externalName?: string;
  externalEmail?: string;
  externalPhone?: string;
  role: EventParticipantRole;
  notes?: string;
}

interface EventResourcePayload {
  catalogItemId?: string;
  name: string;
  quantity: number;
  unit: string;
  unitCost?: number | null;
  notes?: string | null;
}

interface EventTimelineEntryPayload {
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt?: string | null;
  sortOrder?: number;
}

@Injectable({ providedIn: "root" })
export class EventsService {
  constructor(private readonly http: HttpClient) {}

  list(organizationId: string, filters: Record<string, string | number | boolean | undefined>): Promise<PaginatedEvents> {
    return firstValueFrom(
      this.http.get<PaginatedEvents>(`${API_URL}/organizations/${organizationId}/events`, {
        params: this.params(filters),
        withCredentials: true
      })
    );
  }

  summary(organizationId: string): Promise<EventSummary> {
    return firstValueFrom(this.http.get<EventSummary>(`${API_URL}/organizations/${organizationId}/events/summary`, { withCredentials: true }));
  }

  calendar(organizationId: string, from: string, to: string): Promise<CalendarEvent[]> {
    return firstValueFrom(
      this.http.get<CalendarEvent[]>(`${API_URL}/organizations/${organizationId}/events/calendar`, {
        params: this.params({ from, to }),
        withCredentials: true
      })
    );
  }

  create(organizationId: string, payload: EventPayload): Promise<Event> {
    return firstValueFrom(this.http.post<Event>(`${API_URL}/organizations/${organizationId}/events`, payload, { withCredentials: true }));
  }

  createFromQuotation(organizationId: string, quotationId: string, payload: EventPayload): Promise<Event> {
    return firstValueFrom(
      this.http.post<Event>(`${API_URL}/organizations/${organizationId}/quotations/${quotationId}/create-event`, payload, { withCredentials: true })
    );
  }

  get(organizationId: string, eventId: string): Promise<Event> {
    return firstValueFrom(this.http.get<Event>(`${API_URL}/organizations/${organizationId}/events/${eventId}`, { withCredentials: true }));
  }

  update(organizationId: string, eventId: string, payload: EventPayload): Promise<Event> {
    return firstValueFrom(this.http.patch<Event>(`${API_URL}/organizations/${organizationId}/events/${eventId}`, payload, { withCredentials: true }));
  }

  archive(organizationId: string, eventId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${API_URL}/organizations/${organizationId}/events/${eventId}`, { withCredentials: true }));
  }

  changeStatus(organizationId: string, eventId: string, action: "confirm" | "start" | "complete" | "cancel"): Promise<Event> {
    return firstValueFrom(
      this.http.post<Event>(`${API_URL}/organizations/${organizationId}/events/${eventId}/${action}`, {}, { withCredentials: true })
    );
  }

  createTask(organizationId: string, eventId: string, payload: EventTaskPayload): Promise<EventTask> {
    return firstValueFrom(this.http.post<EventTask>(`${API_URL}/organizations/${organizationId}/events/${eventId}/tasks`, payload, { withCredentials: true }));
  }

  updateTask(organizationId: string, eventId: string, taskId: string, payload: EventTaskPayload): Promise<EventTask> {
    return firstValueFrom(this.http.patch<EventTask>(`${API_URL}/organizations/${organizationId}/events/${eventId}/tasks/${taskId}`, payload, { withCredentials: true }));
  }

  createParticipant(organizationId: string, eventId: string, payload: EventParticipantPayload): Promise<EventParticipant> {
    return firstValueFrom(this.http.post<EventParticipant>(`${API_URL}/organizations/${organizationId}/events/${eventId}/participants`, payload, { withCredentials: true }));
  }

  createResource(organizationId: string, eventId: string, payload: EventResourcePayload): Promise<EventResource> {
    return firstValueFrom(this.http.post<EventResource>(`${API_URL}/organizations/${organizationId}/events/${eventId}/resources`, payload, { withCredentials: true }));
  }

  createTimelineEntry(organizationId: string, eventId: string, payload: EventTimelineEntryPayload): Promise<EventTimelineEntry> {
    return firstValueFrom(this.http.post<EventTimelineEntry>(`${API_URL}/organizations/${organizationId}/events/${eventId}/timeline`, payload, { withCredentials: true }));
  }

  private params(filters: Record<string, string | number | boolean | undefined>): HttpParams {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        params = params.set(key, String(value));
      }
    });
    return params;
  }
}
