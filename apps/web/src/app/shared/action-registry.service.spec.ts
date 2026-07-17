import { ActionRegistryService } from "./action-registry.service";
import { Permission } from "../organizations/organization.models";

describe("ActionRegistryService", () => {
  const registry = new ActionRegistryService();
  const allPermissions = (): boolean => true;

  it("resolves every supported action to its canonical route", () => {
    const actions = registry.resolve({ organizationId: "org-1" }, allPermissions);
    expect(Object.fromEntries(actions.map((item) => [item.id, item.route]))).toEqual({
      "create-client": "/organizations/org-1/clients/new",
      "create-catalog": "/organizations/org-1/catalog/new",
      "create-quotation": "/organizations/org-1/quotations/new",
      "create-event": "/organizations/org-1/events/new",
      "invite-member": "/organizations/org-1/members",
      "change-organization": "/organizations",
      home: "/organizations/org-1",
      clients: "/organizations/org-1/clients",
      catalog: "/organizations/org-1/catalog",
      quotations: "/organizations/org-1/quotations",
      events: "/organizations/org-1/events",
      members: "/organizations/org-1/members",
      settings: "/organizations/org-1/settings"
    });
  });

  it("applies RBAC to both creation and navigation actions", () => {
    const allowed = new Set<Permission>(["organization.read", "clients.read"]);
    const actions = registry.resolve(
      { organizationId: "org-1" },
      (permission) => allowed.has(permission)
    );
    expect(actions.map((action) => action.id)).toEqual([
      "change-organization",
      "home",
      "clients"
    ]);
  });

  it("keeps organization switching available without an active tenant", () => {
    expect(registry.resolve({ organizationId: null }, allPermissions).map((item) => item.id)).toEqual([
      "change-organization"
    ]);
  });
});
