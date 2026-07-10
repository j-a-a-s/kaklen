import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  Organization,
  OrganizationInvitation,
  OrganizationMembership,
  OrganizationMembershipStatus,
  OrganizationRole,
  OrganizationStatus,
  Prisma,
  User
} from "@prisma/client";
import { randomBytes } from "node:crypto";
import * as argon2 from "argon2";
import { readOrganizationConfig } from "@kaklen/config";
import { PrismaService } from "../prisma/prisma.service";
import { AuthenticatedRequest } from "../auth/auth.types";
import {
  AcceptInvitationDto,
  CreateOrganizationDto,
  InviteMemberDto,
  OrganizationInvitationDto,
  OrganizationMemberDto,
  OrganizationResponseDto,
  UpdateMembershipDto,
  UpdateOrganizationDto
} from "./dto/organization.dto";
import { Permission, permissionsForRole } from "./permissions";

type MembershipWithUser = OrganizationMembership & { user: User };

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateOrganizationDto): Promise<OrganizationResponseDto> {
    const slug = await this.createUniqueSlug(dto.name);

    const organization = await this.prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          name: dto.name.trim(),
          slug,
          legalName: dto.legalName?.trim() || null,
          taxId: dto.taxId?.trim() || null,
          createdByUserId: userId
        }
      });

      await tx.organizationMembership.create({
        data: {
          organizationId: created.id,
          userId,
          role: OrganizationRole.OWNER,
          status: OrganizationMembershipStatus.ACTIVE
        }
      });

      await this.audit(tx, created.id, userId, "organization.created", "organization", created.id);
      return created;
    });

    return this.toOrganizationDto(organization);
  }

  async list(userId: string): Promise<OrganizationResponseDto[]> {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        userId,
        status: OrganizationMembershipStatus.ACTIVE,
        organization: { status: { not: OrganizationStatus.DELETED }, deletedAt: null }
      },
      include: { organization: true },
      orderBy: { joinedAt: "asc" }
    });

    return memberships.map((membership) => this.toOrganizationDto(membership.organization));
  }

  async get(organizationId: string): Promise<OrganizationResponseDto> {
    return this.toOrganizationDto(await this.findActiveOrganization(organizationId));
  }

  async update(
    organizationId: string,
    actorUserId: string,
    dto: UpdateOrganizationDto
  ): Promise<OrganizationResponseDto> {
    await this.findActiveOrganization(organizationId);
    const organization = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id: organizationId },
        data: {
          name: dto.name?.trim(),
          legalName: dto.legalName === undefined ? undefined : dto.legalName?.trim() || null,
          taxId: dto.taxId === undefined ? undefined : dto.taxId?.trim() || null
        }
      });
      await this.audit(tx, organizationId, actorUserId, "organization.updated", "organization", organizationId);
      return updated;
    });

    return this.toOrganizationDto(organization);
  }

  async members(organizationId: string): Promise<OrganizationMemberDto[]> {
    await this.findActiveOrganization(organizationId);
    const memberships = await this.prisma.organizationMembership.findMany({
      where: { organizationId },
      include: { user: true },
      orderBy: { createdAt: "asc" }
    });

    return memberships.map((membership) => this.toMemberDto(membership));
  }

  async updateMember(
    organizationId: string,
    membershipId: string,
    actor: OrganizationMembership,
    dto: UpdateMembershipDto
  ): Promise<OrganizationMemberDto> {
    const target = await this.findMembership(organizationId, membershipId);
    this.assertAdminCanTouchTarget(actor, target);

    if (target.role === OrganizationRole.OWNER && dto.role && dto.role !== OrganizationRole.OWNER) {
      await this.assertNotLastOwner(organizationId, target.id);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const membership = await tx.organizationMembership.update({
        where: { id: membershipId },
        data: {
          role: dto.role,
          status: dto.status
        },
        include: { user: true }
      });
      await this.audit(tx, organizationId, actor.userId, "membership.updated", "membership", membershipId, {
        role: dto.role,
        status: dto.status
      });
      return membership;
    });

    return this.toMemberDto(updated);
  }

  async removeMember(
    organizationId: string,
    membershipId: string,
    actor: OrganizationMembership
  ): Promise<void> {
    const target = await this.findMembership(organizationId, membershipId);
    this.assertAdminCanTouchTarget(actor, target);

    if (target.role === OrganizationRole.OWNER) {
      await this.assertNotLastOwner(organizationId, target.id);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.organizationMembership.delete({ where: { id: membershipId } });
      await this.audit(tx, organizationId, actor.userId, "membership.removed", "membership", membershipId);
    });
  }

  async invite(
    organizationId: string,
    actorUserId: string,
    dto: InviteMemberDto
  ): Promise<OrganizationInvitationDto> {
    if (dto.role === OrganizationRole.OWNER) {
      throw new BadRequestException("OWNER cannot be invited directly");
    }

    await this.findActiveOrganization(organizationId);
    const config = readOrganizationConfig(process.env);
    const invitationToken = randomBytes(48).toString("base64url");
    const email = dto.email.trim().toLowerCase();
    const tokenHash = await argon2.hash(invitationToken, { type: argon2.argon2id });
    const invitation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.organizationInvitation.create({
        data: {
          organizationId,
          email,
          role: dto.role,
          tokenHash,
          expiresAt: new Date(Date.now() + config.organizationInvitationExpiresSeconds * 1000),
          invitedByUserId: actorUserId
        }
      });
      await this.audit(tx, organizationId, actorUserId, "invitation.created", "invitation", created.id, {
        email,
        role: dto.role
      });
      return created;
    });

    return this.toInvitationDto(invitation, invitationToken);
  }

  async invitations(organizationId: string): Promise<OrganizationInvitationDto[]> {
    await this.findActiveOrganization(organizationId);
    const invitations = await this.prisma.organizationInvitation.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" }
    });

    return invitations.map((invitation) => this.toInvitationDto(invitation));
  }

  async revokeInvitation(
    organizationId: string,
    invitationId: string,
    actorUserId: string
  ): Promise<void> {
    await this.findActiveOrganization(organizationId);
    const invitation = await this.prisma.organizationInvitation.findFirst({
      where: { id: invitationId, organizationId }
    });

    if (!invitation) {
      throw new NotFoundException("Invitation not found");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.organizationInvitation.update({
        where: { id: invitationId },
        data: { revokedAt: new Date() }
      });
      await this.audit(tx, organizationId, actorUserId, "invitation.revoked", "invitation", invitationId);
    });
  }

  async acceptInvitation(
    userId: string,
    dto: AcceptInvitationDto
  ): Promise<OrganizationResponseDto> {
    const invitations = await this.prisma.organizationInvitation.findMany({
      where: {
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        organization: { status: OrganizationStatus.ACTIVE, deletedAt: null }
      },
      include: { organization: true }
    });

    for (const invitation of invitations) {
      if (await argon2.verify(invitation.tokenHash, dto.token)) {
        const organization = await this.prisma.$transaction(async (tx) => {
          const user = await tx.user.findUnique({ where: { id: userId } });
          if (!user || user.email.toLowerCase() !== invitation.email) {
            throw new ForbiddenException("Invitation cannot be accepted");
          }

          await tx.organizationMembership.upsert({
            where: {
              organizationId_userId: {
                organizationId: invitation.organizationId,
                userId
              }
            },
            update: {
              role: invitation.role,
              status: OrganizationMembershipStatus.ACTIVE,
              joinedAt: new Date()
            },
            create: {
              organizationId: invitation.organizationId,
              userId,
              role: invitation.role,
              status: OrganizationMembershipStatus.ACTIVE
            }
          });
          await tx.organizationInvitation.update({
            where: { id: invitation.id },
            data: { acceptedAt: new Date() }
          });
          await this.audit(tx, invitation.organizationId, userId, "invitation.accepted", "invitation", invitation.id);
          return invitation.organization;
        });

        return this.toOrganizationDto(organization);
      }
    }

    throw new BadRequestException("Invitation is invalid or expired");
  }

  permissionsForMembership(membership: OrganizationMembership): Permission[] {
    return [...permissionsForRole(membership.role)];
  }

  private async findActiveOrganization(organizationId: string): Promise<Organization> {
    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId, status: { not: OrganizationStatus.DELETED }, deletedAt: null }
    });

    if (!organization) {
      throw new NotFoundException("Organization not found");
    }

    return organization;
  }

  private async findMembership(
    organizationId: string,
    membershipId: string
  ): Promise<OrganizationMembership> {
    const membership = await this.prisma.organizationMembership.findFirst({
      where: { id: membershipId, organizationId }
    });

    if (!membership) {
      throw new NotFoundException("Member not found");
    }

    return membership;
  }

  private assertAdminCanTouchTarget(
    actor: OrganizationMembership,
    target: OrganizationMembership
  ): void {
    if (actor.role === OrganizationRole.ADMIN && target.role === OrganizationRole.OWNER) {
      throw new ForbiddenException("ADMIN cannot modify OWNER memberships");
    }
  }

  private async assertNotLastOwner(organizationId: string, excludedMembershipId: string): Promise<void> {
    const remainingOwners = await this.prisma.organizationMembership.count({
      where: {
        organizationId,
        id: { not: excludedMembershipId },
        role: OrganizationRole.OWNER,
        status: OrganizationMembershipStatus.ACTIVE
      }
    });

    if (remainingOwners === 0) {
      throw new ConflictException("The last OWNER cannot be changed or removed");
    }
  }

  private async createUniqueSlug(name: string): Promise<string> {
    const base = this.slugify(name);
    let slug = base;
    let index = 2;

    while (await this.prisma.organization.findUnique({ where: { slug } })) {
      slug = `${base}-${index}`;
      index += 1;
    }

    return slug;
  }

  private slugify(name: string): string {
    const slug = name
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return slug || `org-${randomBytes(4).toString("hex")}`;
  }

  private toOrganizationDto(organization: Organization): OrganizationResponseDto {
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      legalName: organization.legalName,
      taxId: organization.taxId,
      country: organization.country,
      currency: organization.currency,
      timezone: organization.timezone,
      status: organization.status,
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString()
    };
  }

  private toMemberDto(membership: MembershipWithUser): OrganizationMemberDto {
    return {
      id: membership.id,
      userId: membership.userId,
      email: membership.user.email,
      firstName: membership.user.firstName,
      lastName: membership.user.lastName,
      role: membership.role,
      status: membership.status,
      joinedAt: membership.joinedAt.toISOString()
    };
  }

  private toInvitationDto(
    invitation: OrganizationInvitation,
    invitationToken?: string
  ): OrganizationInvitationDto {
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
      acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
      revokedAt: invitation.revokedAt?.toISOString() ?? null,
      invitationToken: process.env.NODE_ENV === "production" ? undefined : invitationToken
    };
  }

  private audit(
    tx: Prisma.TransactionClient,
    organizationId: string,
    actorUserId: string,
    action: string,
    targetType: string,
    targetId?: string,
    metadata?: Prisma.InputJsonValue
  ): Promise<unknown> {
    return tx.organizationAuditLog.create({
      data: {
        organizationId,
        actorUserId,
        action,
        targetType,
        targetId,
        metadata
      }
    });
  }
}
