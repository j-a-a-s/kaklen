import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { API_BASE_URL } from "../config/runtime-config";
import { InAppNotification, InAppNotificationsService } from "./in-app-notifications.service";

describe("InAppNotificationsService", () => {
  let service: InAppNotificationsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(InAppNotificationsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.deactivate();
    http.verify();
  });

  it("loads tenant notifications as background traffic", async () => {
    const activation = service.activate("org-1");
    const itemsRequest = http.expectOne(`${API_BASE_URL}/organizations/org-1/notifications`);
    const countRequest = http.expectOne(`${API_BASE_URL}/organizations/org-1/notifications/unread-count`);
    expect(itemsRequest.request.headers.get("X-Kaklen-Background")).toBe("true");
    itemsRequest.flush([notification()]);
    countRequest.flush({ count: 1 });
    await activation;
    expect(service.items().length).toBe(1);
    expect(service.unread()).toBe(1);
  });

  it("updates read state and clears session data on deactivate", async () => {
    const activation = service.activate("org-1");
    http.expectOne(`${API_BASE_URL}/organizations/org-1/notifications`).flush([notification()]);
    http.expectOne(`${API_BASE_URL}/organizations/org-1/notifications/unread-count`).flush({ count: 1 });
    await activation;

    const markRead = service.markRead("notification-1");
    http.expectOne(`${API_BASE_URL}/organizations/org-1/notifications/notification-1/read`).flush({});
    await markRead;
    expect(service.items()[0].readAt).not.toBeNull();
    expect(service.unread()).toBe(0);

    service.deactivate();
    expect(service.items()).toEqual([]);
    expect(service.unread()).toBe(0);
  });
});

function notification(): InAppNotification {
  return {
    id: "notification-1",
    type: "QUOTATION_VIEWED",
    title: "Quotation viewed",
    body: "The customer opened the quotation.",
    resourceType: "quotation",
    resourceId: "quotation-1",
    route: "/organizations/org-1/quotations/quotation-1",
    readAt: null,
    createdAt: "2026-07-17T12:00:00.000Z"
  };
}
