import { EventParticipantRole, EventTaskPriority, EventTaskStatus } from "@prisma/client";
import { EventsController } from "./events.controller";

describe("EventsController", () => {
  it("delegates event lifecycle, tasks, participants, resources, and timeline to the service", async () => {
    const service = makeEventsService();
    const controller = new EventsController(service as never);
    const request = { user: { sub: "user-1" } };

    await controller.create("org-1", request as never, {
      name: "Gala",
      startAt: "2026-08-01T10:00:00.000Z",
      endAt: "2026-08-01T12:00:00.000Z"
    });
    await controller.createFromQuotation("org-1", "quotation-1", request as never, {
      name: "Gala",
      startAt: "2026-08-01T10:00:00.000Z",
      endAt: "2026-08-01T12:00:00.000Z"
    });
    await controller.list("org-1", { page: 1, pageSize: 20 });
    await controller.summary("org-1");
    await controller.calendar("org-1", { from: "2026-08-01T00:00:00.000Z", to: "2026-08-31T23:59:59.000Z" });
    await controller.get("org-1", "event-1");
    await controller.update("org-1", "event-1", request as never, { name: "Gala final" });
    await controller.archive("org-1", "event-1", request as never);
    await controller.confirm("org-1", "event-1", request as never, {});
    await controller.start("org-1", "event-1", request as never, {});
    await controller.complete("org-1", "event-1", request as never, {});
    await controller.cancel("org-1", "event-1", request as never, {});

    const taskDto = { title: "Task", status: EventTaskStatus.PENDING, priority: EventTaskPriority.MEDIUM };
    await controller.createTask("org-1", "event-1", request as never, taskDto);
    await controller.listTasks("org-1", "event-1");
    await controller.updateTask("org-1", "event-1", "task-1", request as never, taskDto);
    await controller.deleteTask("org-1", "event-1", "task-1");

    await controller.createParticipant("org-1", "event-1", { role: EventParticipantRole.GUEST, externalName: "Guest" });
    await controller.listParticipants("org-1", "event-1");
    await controller.deleteParticipant("org-1", "event-1", "participant-1");

    const resourceDto = { name: "Speaker", quantity: 1, unit: "unit" };
    await controller.createResource("org-1", "event-1", resourceDto);
    await controller.listResources("org-1", "event-1");
    await controller.updateResource("org-1", "event-1", "resource-1", resourceDto);
    await controller.deleteResource("org-1", "event-1", "resource-1");

    const timelineDto = { title: "Open", startsAt: "2026-08-01T10:00:00.000Z" };
    await controller.createTimelineEntry("org-1", "event-1", timelineDto);
    await controller.listTimeline("org-1", "event-1");
    await controller.updateTimelineEntry("org-1", "event-1", "timeline-1", timelineDto);
    await controller.deleteTimelineEntry("org-1", "event-1", "timeline-1");

    expect(service.create).toHaveBeenCalledWith("org-1", "user-1", expect.objectContaining({ name: "Gala" }));
    expect(service.createFromQuotation).toHaveBeenCalledWith("org-1", "quotation-1", "user-1", expect.objectContaining({ name: "Gala" }));
    expect(service.archive).toHaveBeenCalledWith("org-1", "event-1", "user-1");
    expect(service.updateTask).toHaveBeenCalledWith("org-1", "event-1", "task-1", "user-1", taskDto);
    expect(service.updateTimelineEntry).toHaveBeenCalledWith("org-1", "event-1", "timeline-1", timelineDto);
  });
});

function makeEventsService() {
  const ok = async () => ({ id: "result" });
  return {
    create: jest.fn(ok),
    createFromQuotation: jest.fn(ok),
    list: jest.fn(ok),
    summary: jest.fn(ok),
    calendar: jest.fn(ok),
    get: jest.fn(ok),
    update: jest.fn(ok),
    archive: jest.fn(async () => undefined),
    confirm: jest.fn(ok),
    start: jest.fn(ok),
    complete: jest.fn(ok),
    cancel: jest.fn(ok),
    createTask: jest.fn(ok),
    listTasks: jest.fn(ok),
    updateTask: jest.fn(ok),
    deleteTask: jest.fn(async () => undefined),
    createParticipant: jest.fn(ok),
    listParticipants: jest.fn(ok),
    deleteParticipant: jest.fn(async () => undefined),
    createResource: jest.fn(ok),
    listResources: jest.fn(ok),
    updateResource: jest.fn(ok),
    deleteResource: jest.fn(async () => undefined),
    createTimelineEntry: jest.fn(ok),
    listTimeline: jest.fn(ok),
    updateTimelineEntry: jest.fn(ok),
    deleteTimelineEntry: jest.fn(async () => undefined)
  };
}
