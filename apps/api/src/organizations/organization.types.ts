import type { Request } from "express";
import { OrganizationMembership } from "@prisma/client";
import type { JwtAccessPayload } from "../auth/auth.types";

export interface OrganizationRequest extends Request {
  user: JwtAccessPayload;
  organizationMembership?: OrganizationMembership;
}
