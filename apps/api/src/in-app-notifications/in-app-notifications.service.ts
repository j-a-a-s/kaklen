import { Injectable, NotFoundException } from "@nestjs/common";
import {
  InAppNotification,
  InAppNotificationType,
  OrganizationMembershipStatus
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface CreateOrganizationNotification {
  type: InAppNotificationType;
  title: string;
  body: string;
  resourceType: string;
  resourceId?: string;
  route?: string;
  excludeUserId?: string;
}

@Injectable()
export class InAppNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notifyOrganization(
    organizationId: string,
    input: CreateOrganizationNotification
  ): Promise<number> {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        organizationId,
        status: OrganizationMembershipStatus.ACTIVE,
        ...(input.excludeUserId ? { userId: { not: input.excludeUserId } } : {})
      },
      select: { userId: true }
    });
    if (memberships.length === 0) {
      return 0;
    }
    const result = await this.prisma.inAppNotification.createMany({
      data: memberships.map(({ userId }) => ({
        organizationId,
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        route: input.route
      }))
    });
    return result.count;
  }

  list(organizationId: string, userId: string, limit = 30): Promise<InAppNotification[]> {
    return this.prisma.inAppNotification.findMany({
      where: { organizationId, userId },
      orderBy: { createdAt: "desc" },
      take: limit
    });
  }

  async unreadCount(organizationId: string, userId: string): Promise<{ count: number }> {
    return {
      count: await this.prisma.inAppNotification.count({
        where: { organizationId, userId, readAt: null }
      })
    };
  }

  async markRead(
    organizationId: string,
    userId: string,
    notificationId: string
  ): Promise<InAppNotification> {
    const notification = await this.prisma.inAppNotification.findFirst({
      where: { id: notificationId, organizationId, userId }
    });
    if (!notification) {
      throw new NotFoundException({ code: "NOTIFICATION_NOT_FOUND", message: "Notification not found" });
    }
    if (notification.readAt) {
      return notification;
    }
    return this.prisma.inAppNotification.update({
      where: { id: notification.id },
      data: { readAt: new Date() }
    });
  }

  async markAllRead(organizationId: string, userId: string): Promise<{ count: number }> {
    const result = await this.prisma.inAppNotification.updateMany({
      where: { organizationId, userId, readAt: null },
      data: { readAt: new Date() }
    });
    return { count: result.count };
  }
}
