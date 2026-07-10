import { SetMetadata } from "@nestjs/common";
import type { Permission } from "./permissions";

export const REQUIRED_PERMISSIONS_KEY = "requiredOrganizationPermissions";

export function RequirePermissions(...permissions: Permission[]): MethodDecorator {
  return SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
}
