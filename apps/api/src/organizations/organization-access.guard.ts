import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { OrganizationMembershipStatus, OrganizationStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { OrganizationRequest } from "./organization.types";
import { REQUIRED_PERMISSIONS_KEY } from "./require-permissions.decorator";
import { Permission, roleHasPermissions } from "./permissions";

@Injectable()
export class OrganizationAccessGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<OrganizationRequest>();
    const rawOrganizationId = request.params["organizationId"];
    const organizationId = Array.isArray(rawOrganizationId) ? rawOrganizationId[0] : rawOrganizationId;

    if (!organizationId) {
      throw new NotFoundException("Organization not found");
    }

    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        organizationId,
        userId: request.user.sub,
        status: OrganizationMembershipStatus.ACTIVE,
        organization: {
          status: { not: OrganizationStatus.DELETED },
          deletedAt: null
        }
      }
    });

    if (!membership) {
      throw new NotFoundException("Organization not found");
    }

    const requiredPermissions =
      this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass()
      ]) ?? [];

    if (!roleHasPermissions(membership.role, requiredPermissions)) {
      throw new ForbiddenException("Insufficient organization permissions");
    }

    request.organizationMembership = membership;
    return true;
  }
}
