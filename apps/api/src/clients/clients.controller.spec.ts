import { ClientInteractionType, ClientType } from "@prisma/client";
import { ClientsController } from "./clients.controller";

describe("ClientsController", () => {
  it("delegates client CRUD and interactions with actor context", async () => {
    const service = makeClientsService();
    const controller = new ClientsController(service as never);
    const request = { user: { sub: "user-1" } };
    const clientDto = { type: ClientType.NATURAL_PERSON, displayName: "Ada" };
    const interactionDto = { type: ClientInteractionType.NOTE, description: "Follow-up", occurredAt: "2026-08-01T10:00:00.000Z" };

    await controller.create("org-1", request as never, clientDto);
    await controller.list("org-1", { page: 1, pageSize: 20 });
    await controller.summary("org-1");
    await controller.get("org-1", "client-1");
    await controller.update("org-1", "client-1", request as never, { firstName: "Ada", lastName: "Lovelace" });
    await controller.archive("org-1", "client-1", request as never);
    await controller.createInteraction("org-1", "client-1", request as never, interactionDto);
    await controller.interactions("org-1", "client-1");

    expect(service.create).toHaveBeenCalledWith("org-1", "user-1", clientDto);
    expect(service.update).toHaveBeenCalledWith("org-1", "client-1", "user-1", { firstName: "Ada", lastName: "Lovelace" });
    expect(service.archive).toHaveBeenCalledWith("org-1", "client-1", "user-1");
    expect(service.createInteraction).toHaveBeenCalledWith("org-1", "client-1", "user-1", interactionDto);
  });
});

function makeClientsService() {
  const ok = async () => ({ id: "result" });
  return {
    create: jest.fn(ok),
    list: jest.fn(ok),
    summary: jest.fn(ok),
    get: jest.fn(ok),
    update: jest.fn(ok),
    archive: jest.fn(async () => undefined),
    createInteraction: jest.fn(ok),
    interactions: jest.fn(ok)
  };
}
