import { BadRequestException } from "@nestjs/common";
import { EventStatus } from "@prisma/client";
import { EventsService } from "./events.service";

type TransitionProbe = {
  assertTransition(previous: EventStatus, next: EventStatus): void;
};

type DatesProbe = {
  assertDates(startAt: string, endAt: string): void;
};

type CodeProbe = {
  nextCode(
    organizationId: string,
    tx: { event: { findFirst(args: unknown): Promise<{ code: string } | null> } }
  ): Promise<string>;
};

type WhereProbe = {
  buildWhere(organizationId: string, query: { search?: string; includeArchived?: boolean; city?: string }): unknown;
};

describe("EventsService", () => {
  const service = new EventsService({} as ConstructorParameters<typeof EventsService>[0]);

  it("rejects invalid event date ranges", () => {
    const probe = service as unknown as DatesProbe;

    expect(() => probe.assertDates("2026-07-10T12:00:00.000Z", "2026-07-10T12:00:00.000Z")).toThrow(BadRequestException);
    expect(() => probe.assertDates("2026-07-10T13:00:00.000Z", "2026-07-10T12:00:00.000Z")).toThrow(BadRequestException);
  });

  it("accepts valid event date ranges", () => {
    const probe = service as unknown as DatesProbe;

    expect(() => probe.assertDates("2026-07-10T12:00:00.000Z", "2026-07-10T13:00:00.000Z")).not.toThrow();
  });

  it("allows valid status transitions", () => {
    const probe = service as unknown as TransitionProbe;

    expect(() => probe.assertTransition(EventStatus.DRAFT, EventStatus.CONFIRMED)).not.toThrow();
    expect(() => probe.assertTransition(EventStatus.CONFIRMED, EventStatus.IN_PROGRESS)).not.toThrow();
    expect(() => probe.assertTransition(EventStatus.IN_PROGRESS, EventStatus.COMPLETED)).not.toThrow();
  });

  it("rejects invalid status transitions", () => {
    const probe = service as unknown as TransitionProbe;

    expect(() => probe.assertTransition(EventStatus.COMPLETED, EventStatus.IN_PROGRESS)).toThrow(BadRequestException);
    expect(() => probe.assertTransition(EventStatus.CANCELLED, EventStatus.CONFIRMED)).toThrow(BadRequestException);
  });

  it("generates sequential event codes", async () => {
    const probe = service as unknown as CodeProbe;
    const code = await probe.nextCode("org-1", {
      event: {
        findFirst: async () => ({ code: "EVT-000041" })
      }
    });

    expect(code).toBe("EVT-000042");
  });

  it("starts event codes at one", async () => {
    const probe = service as unknown as CodeProbe;
    const code = await probe.nextCode("org-1", {
      event: {
        findFirst: async () => null
      }
    });

    expect(code).toBe("EVT-000001");
  });

  it("excludes archived events by default", () => {
    const probe = service as unknown as WhereProbe;

    expect(probe.buildWhere("org-1", {})).toMatchObject({
      organizationId: "org-1",
      archivedAt: null,
      status: { not: EventStatus.ARCHIVED }
    });
  });

  it("allows archived events when requested", () => {
    const probe = service as unknown as WhereProbe;

    expect(probe.buildWhere("org-1", { includeArchived: true })).toEqual({ organizationId: "org-1" });
  });

  it("builds organization-scoped search filters", () => {
    const probe = service as unknown as WhereProbe;

    expect(probe.buildWhere("org-1", { search: " gala ", city: "Santiago" })).toMatchObject({
      organizationId: "org-1",
      city: { contains: "Santiago", mode: "insensitive" }
    });
  });
});
