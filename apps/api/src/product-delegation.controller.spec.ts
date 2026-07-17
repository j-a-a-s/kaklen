import { InAppNotificationsController } from "./in-app-notifications/in-app-notifications.controller";
import { PaymentsController, PublicPaymentsController } from "./payments/payments.controller";
import {
  ProviderProfilesController,
  PublicProviderProfilesController
} from "./provider-profiles/provider-profiles.controller";
import {
  PublicQuotationPortalController,
  QuotationPortalAdminController
} from "./quotation-portal/quotation-portal.controller";
import { WhatsAppController } from "./whatsapp/whatsapp.controller";

describe("product controller delegation", () => {
  const request = { user: { sub: "user-1" } } as never;

  it("delegates notification operations with tenant and user scope", async () => {
    const service = {
      list: jest.fn(async () => ["notification"]),
      unreadCount: jest.fn(async () => ({ count: 1 })),
      markAllRead: jest.fn(async () => ({ count: 1 })),
      markRead: jest.fn(async () => ({ id: "notification-1" }))
    };
    const controller = new InAppNotificationsController(service as never);

    await expect(controller.list("org-1", request, { limit: 10 })).resolves.toEqual(["notification"]);
    await expect(controller.unreadCount("org-1", request)).resolves.toEqual({ count: 1 });
    await expect(controller.markAllRead("org-1", request)).resolves.toEqual({ count: 1 });
    await expect(controller.markRead("org-1", "notification-1", request))
      .resolves.toEqual({ id: "notification-1" });
    expect(service.list).toHaveBeenCalledWith("org-1", "user-1", 10);
    expect(service.markRead).toHaveBeenCalledWith("org-1", "user-1", "notification-1");
  });

  it("delegates authenticated and public quotation portal operations", async () => {
    const service = {
      createLink: jest.fn(async () => ({ publicToken: "token" })),
      revokeLink: jest.fn(async () => ({ revoked: 1 })),
      view: jest.fn(async () => ({ quotation: {} })),
      requestChanges: jest.fn(async () => ({ status: "CHANGES_REQUESTED" })),
      approve: jest.fn(async () => ({ status: "APPROVED" }))
    };
    const admin = new QuotationPortalAdminController(service as never);
    const publicPortal = new PublicQuotationPortalController(service as never);

    await expect(admin.create("org-1", "quotation-1", request, { locale: "es" }))
      .resolves.toEqual({ publicToken: "token" });
    await expect(admin.revoke("org-1", "quotation-1")).resolves.toEqual({ revoked: 1 });
    await expect(publicPortal.view("token")).resolves.toEqual({ quotation: {} });
    await expect(publicPortal.requestChanges("token", { comment: "Cambiar fecha" }))
      .resolves.toEqual({ status: "CHANGES_REQUESTED" });
    await expect(publicPortal.approve("token")).resolves.toEqual({ status: "APPROVED" });
    expect(service.createLink).toHaveBeenCalledWith("org-1", "quotation-1", "user-1", { locale: "es" });
  });

  it("delegates WhatsApp and public payment lifecycle operations", async () => {
    const whatsapp = { prepare: jest.fn(async () => ({ status: "PREPARED" })) };
    const whatsappController = new WhatsAppController(whatsapp as never);
    await expect(whatsappController.prepare("org-1", "quotation-1", request, {
      publicToken: "x".repeat(43),
      locale: "es"
    })).resolves.toEqual({ status: "PREPARED" });
    expect(whatsapp.prepare).toHaveBeenCalledWith(
      "org-1",
      "quotation-1",
      "user-1",
      { publicToken: "x".repeat(43), locale: "es" }
    );

    const payments = {
      createPublicIntent: jest.fn(async () => ({ status: "PENDING" })),
      checkout: jest.fn(async () => ({ sandbox: true })),
      completeSandbox: jest.fn(async () => ({ status: "PAID" })),
      processWebhook: jest.fn(async () => ({ status: "PAID" })),
      get: jest.fn(async () => ({ id: "payment-1" })),
      cancel: jest.fn(async () => ({ status: "CANCELLED" })),
      refund: jest.fn(async () => ({ status: "REFUNDED" }))
    };
    const publicPayments = new PublicPaymentsController(payments as never);
    const adminPayments = new PaymentsController(payments as never);
    const createDto = { idempotencyKey: "11111111-1111-4111-8111-111111111111", locale: "es" as const };

    await expect(publicPayments.create("token", createDto)).resolves.toEqual({ status: "PENDING" });
    await expect(publicPayments.checkout("checkout")).resolves.toEqual({ sandbox: true });
    await expect(publicPayments.complete("checkout", { outcome: "PAID" })).resolves.toEqual({ status: "PAID" });
    await expect(publicPayments.webhook({
      eventId: "event-1",
      externalReference: "payment-1",
      status: "PAID",
      amount: "1000.00",
      currency: "CLP"
    }, "signature")).resolves.toEqual({ status: "PAID" });
    await expect(publicPayments.webhook({
      eventId: "event-2",
      externalReference: "payment-1",
      status: "PAID",
      amount: "1000.00",
      currency: "CLP"
    })).resolves.toEqual({ status: "PAID" });
    expect(payments.processWebhook).toHaveBeenLastCalledWith(expect.objectContaining({ eventId: "event-2" }), "");
    await expect(adminPayments.get("org-1", "payment-1")).resolves.toEqual({ id: "payment-1" });
    await expect(adminPayments.cancel("org-1", "payment-1")).resolves.toEqual({ status: "CANCELLED" });
    await expect(adminPayments.refund("org-1", "payment-1", { amount: 1000 }))
      .resolves.toEqual({ status: "REFUNDED" });
  });

  it("delegates public provider conversion and administrative review", async () => {
    const service = {
      recommendationShown: jest.fn(async () => ({ recorded: true })),
      create: jest.fn(async () => ({ status: "IN_REVIEW" })),
      list: jest.fn(async () => []),
      review: jest.fn(async () => ({ status: "PUBLISHED" }))
    };
    const publicProfiles = new PublicProviderProfilesController(service as never);
    const adminProfiles = new ProviderProfilesController(service as never);
    const profile = {
      consent: true as const,
      category: "Eventos",
      description: "Producción integral para eventos corporativos.",
      country: "CL" as const,
      whatsapp: "+56912345678",
      currency: "CLP"
    };

    await expect(publicProfiles.recommendationShown("token")).resolves.toEqual({ recorded: true });
    await expect(publicProfiles.create("token", profile)).resolves.toEqual({ status: "IN_REVIEW" });
    await expect(adminProfiles.list("org-1")).resolves.toEqual([]);
    await expect(adminProfiles.review("org-1", "profile-1", { status: "PUBLISHED" }))
      .resolves.toEqual({ status: "PUBLISHED" });
  });
});
