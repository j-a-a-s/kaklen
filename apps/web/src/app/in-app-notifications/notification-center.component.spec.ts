import { Router } from "@angular/router";
import { signal } from "@angular/core";
import { InAppNotification, InAppNotificationsService } from "./in-app-notifications.service";
import { NotificationCenterComponent } from "./notification-center.component";

describe("NotificationCenterComponent", () => {
  it("shows the safe customer excerpt and follows the change-request deep link", async () => {
    const notification = changeRequestNotification();
    const notifications = {
      unread: signal(1),
      items: signal([notification]),
      loading: signal(false),
      markRead: jasmine.createSpy("markRead").and.resolveTo(),
      markAllRead: jasmine.createSpy("markAllRead").and.resolveTo(),
      activate: jasmine.createSpy("activate").and.resolveTo(),
      deactivate: jasmine.createSpy("deactivate")
    } as unknown as InAppNotificationsService;
    const router = jasmine.createSpyObj<Router>("Router", ["navigateByUrl"]);
    router.navigateByUrl.and.resolveTo(true);
    const component = new NotificationCenterComponent(notifications, router);

    expect(component.body(notification)).toBe(
      "El cliente pidió cambios en una cotización. “Solicito descuentos para los servicios seleccionados.”"
    );

    await component.open(notification);

    expect(notifications.markRead).toHaveBeenCalledWith("notification-1");
    expect(router.navigateByUrl).toHaveBeenCalledWith(
      "/organizations/org-1/quotations/quotation-1#change-requests"
    );
  });
});

function changeRequestNotification(): InAppNotification {
  return {
    id: "notification-1",
    type: "QUOTATION_CHANGES_REQUESTED",
    title: "Changes requested",
    body: "Solicito descuentos para los servicios seleccionados.",
    resourceType: "quotation",
    resourceId: "quotation-1",
    route: "/organizations/org-1/quotations/quotation-1#change-requests",
    readAt: null,
    createdAt: "2026-07-17T21:44:00.000Z"
  };
}
