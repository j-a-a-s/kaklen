import { InAppNotificationType } from "@prisma/client";
import { InAppNotificationsService } from "./in-app-notifications.service";

describe("InAppNotificationsService", () => {
  it("fans out only to active organization members", async () => {
    const prisma = makePrisma();
    const service = new InAppNotificationsService(prisma as never);

    await expect(service.notifyOrganization("org-1", {
      type: InAppNotificationType.QUOTATION_VIEWED,
      title: "Viewed",
      body: "Body",
      resourceType: "quotation"
    })).resolves.toBe(2);

    expect(prisma.organizationMembership.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: "org-1", status: "ACTIVE" })
    }));
    expect(prisma.inAppNotification.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ organizationId: "org-1", userId: "user-1" }),
        expect.objectContaining({ organizationId: "org-1", userId: "user-2" })
      ])
    });
  });

  it("does not create notifications when the organization has no active audience", async () => {
    const prisma = makePrisma();
    prisma.organizationMembership.findMany.mockResolvedValueOnce([]);
    const service = new InAppNotificationsService(prisma as never);

    await expect(service.notifyOrganization("org-1", {
      type: InAppNotificationType.EVENT_UPCOMING,
      title: "Upcoming",
      body: "Body",
      resourceType: "event",
      excludeUserId: "user-1"
    })).resolves.toBe(0);
    expect(prisma.organizationMembership.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: { not: "user-1" } })
    }));
    expect(prisma.inAppNotification.createMany).not.toHaveBeenCalled();
  });

  it("lists notifications and reports the unread count in tenant scope", async () => {
    const prisma = makePrisma();
    prisma.inAppNotification.count.mockResolvedValueOnce(3);
    const service = new InAppNotificationsService(prisma as never);

    await expect(service.list("org-1", "user-1", 12)).resolves.toEqual([]);
    await expect(service.list("org-1", "user-1")).resolves.toEqual([]);
    await expect(service.unreadCount("org-1", "user-1")).resolves.toEqual({ count: 3 });
    expect(prisma.inAppNotification.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", userId: "user-1" },
      orderBy: { createdAt: "desc" },
      take: 12
    });
    expect(prisma.inAppNotification.findMany).toHaveBeenLastCalledWith({
      where: { organizationId: "org-1", userId: "user-1" },
      orderBy: { createdAt: "desc" },
      take: 30
    });
  });

  it("does not allow one tenant or user to mark another notification", async () => {
    const prisma = makePrisma();
    prisma.inAppNotification.findFirst.mockResolvedValueOnce(null as never);
    const service = new InAppNotificationsService(prisma as never);

    await expect(service.markRead("org-2", "user-2", "notification-1")).rejects.toMatchObject({ status: 404 });
    expect(prisma.inAppNotification.update).not.toHaveBeenCalled();
  });

  it("marks all unread notifications only in the active tenant and user scope", async () => {
    const prisma = makePrisma();
    const service = new InAppNotificationsService(prisma as never);

    await service.markAllRead("org-1", "user-1");

    expect(prisma.inAppNotification.updateMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", userId: "user-1", readAt: null },
      data: { readAt: expect.any(Date) }
    });
  });

  it("returns an already read notification without writing it again", async () => {
    const prisma = makePrisma();
    const existing = { id: "notification-1", readAt: new Date() };
    prisma.inAppNotification.findFirst.mockResolvedValueOnce(existing as never);
    const service = new InAppNotificationsService(prisma as never);

    await expect(service.markRead("org-1", "user-1", "notification-1")).resolves.toBe(existing);
    expect(prisma.inAppNotification.update).not.toHaveBeenCalled();
  });

  it("marks one unread notification as read", async () => {
    const prisma = makePrisma();
    const service = new InAppNotificationsService(prisma as never);

    await expect(service.markRead("org-1", "user-1", "notification-1"))
      .resolves.toMatchObject({ id: "notification-1", readAt: expect.any(Date) });
    expect(prisma.inAppNotification.update).toHaveBeenCalledWith({
      where: { id: "notification-1" },
      data: { readAt: expect.any(Date) }
    });
  });
});

function makePrisma() {
  return {
    organizationMembership: { findMany: jest.fn(async () => [{ userId: "user-1" }, { userId: "user-2" }]) },
    inAppNotification: {
      createMany: jest.fn(async () => ({ count: 2 })),
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
      findFirst: jest.fn(async () => ({ id: "notification-1", readAt: null })),
      update: jest.fn(async () => ({ id: "notification-1", readAt: new Date() })),
      updateMany: jest.fn(async () => ({ count: 1 }))
    }
  };
}
