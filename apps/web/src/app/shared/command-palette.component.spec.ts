import { fakeAsync, flushMicrotasks, tick } from "@angular/core/testing";
import { Subject } from "rxjs";
import { CommandPaletteComponent } from "./command-palette.component";

describe("CommandPaletteComponent", () => {
  const organizationId = "organization-1";
  let routes: jasmine.Spy;
  let analytics: jasmine.Spy;
  let permissions: Set<string>;
  let search: jasmine.Spy;
  let component: CommandPaletteComponent;

  beforeEach(() => {
    localStorage.removeItem("kaklen.commandHistory");
    routes = jasmine.createSpy("navigateByUrl").and.resolveTo(true);
    analytics = jasmine.createSpy("track");
    permissions = new Set([
      "organization.read", "organization.update", "organization.members.read", "organization.members.invite",
      "clients.read", "clients.create", "catalog.read", "catalog.create", "quotations.read", "quotations.create",
      "events.read", "events.create"
    ]);
    search = jasmine.createSpy("search").and.resolveTo({
      query: "ac",
      groups: {
        clients: [{ id: "client-1", type: "client", title: "Acme", subtitle: "client", status: "ACTIVE", route: "/client-1", match: "Acme" }],
        catalogItems: [{ id: "catalog-1", type: "catalog_item", title: "Acoustic", subtitle: "SKU AC", status: "ACTIVE", route: "/catalog-1", match: "AC" }],
        quotations: [{ id: "quotation-1", type: "quotation", title: "QUO-1", subtitle: "Acme", status: "SENT", route: "/quotation-1", match: "Acme" }],
        events: [{ id: "event-1", type: "event", title: "Acme launch", subtitle: "Acme", status: "DRAFT", route: "/event-1", match: "Acme" }]
      }
    });
    component = new CommandPaletteComponent(
      { hasPermission: (permission: string) => permissions.has(permission) } as never,
      { search } as never,
      { track: analytics } as never,
      { events: new Subject(), navigateByUrl: routes } as never
    );
    component.organizationId = organizationId;
  });

  afterEach(() => component.ngOnDestroy());

  it("executes every create and navigation action using organization-scoped routes", () => {
    const commands = [...component.actionItems(), ...component.navigationItems()];
    expect(commands.map((item) => item.id)).toEqual([
      "create-client", "create-catalog", "create-quotation", "create-event", "invite-member", "change-organization",
      "home", "clients", "catalog", "quotations", "events", "members", "settings"
    ]);

    commands.forEach((item) => component.run(item));
    expect(routes.calls.count()).toBe(commands.length);
    expect(routes.calls.allArgs().map(([route]) => route)).toContain(`/organizations/${organizationId}/quotations/new`);
    expect(analytics.calls.allArgs().filter(([event]) => event === "command_action_executed").length).toBe(commands.length);
  });

  it("filters local actions from the first character and normalizes accents", () => {
    component.query = "catalogo";
    expect(component.filteredNavigationItems().map((item) => item.id)).toContain("catalog");
    component.query = "n";
    expect(component.filteredActionItems().length).toBeGreaterThan(0);
  });

  it("hides actions denied by RBAC", () => {
    permissions.delete("clients.create");
    permissions.delete("events.create");
    expect(component.actionItems().map((item) => item.id)).not.toContain("create-client");
    expect(component.actionItems().map((item) => item.id)).not.toContain("create-event");
  });

  it("tracks recreated command objects by stable identifiers", () => {
    const first = component.actionItems()[0];
    const recreated = component.actionItems()[0];

    expect(first).not.toBe(recreated);
    expect(component.trackCommand(0, first)).toBe(component.trackCommand(0, recreated));
  });

  it("debounces one remote query and groups all result types", fakeAsync(() => {
    component.queueSearch("ac");
    tick(249);
    expect(search).not.toHaveBeenCalled();
    tick(1);
    flushMicrotasks();

    expect(search).toHaveBeenCalledOnceWith(organizationId, "ac");
    expect(component.resultGroups(component.results()!).map((group) => group.items[0]?.type)).toEqual([
      "client", "catalog_item", "quotation", "event"
    ]);
  }));

  it("uses arrows and Enter internally without activating a background action", () => {
    component.query = "cliente";
    const event = new KeyboardEvent("keydown", { key: "ArrowDown", cancelable: true });
    component.handleKeyboard(event);
    expect(routes).not.toHaveBeenCalled();

    component.open();
    component.handleKeyboard(event);
    expect(event.defaultPrevented).toBeTrue();
    component.handleKeyboard(new KeyboardEvent("keydown", { key: "Enter", cancelable: true }));
    expect(routes).toHaveBeenCalled();
  });
});
