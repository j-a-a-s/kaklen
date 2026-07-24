import { ActivatedRoute } from "@angular/router";
import { LocaleService } from "../i18n/locale.service";
import { PublicPaymentCheckout } from "../portal/quotation-portal.models";
import { QuotationPortalService } from "../portal/quotation-portal.service";
import { PaymentCheckoutComponent } from "./payment-checkout.component";

describe("PaymentCheckoutComponent", () => {
  it("loads a sandbox checkout and confirms only the webhook result", async () => {
    const portal = jasmine.createSpyObj<QuotationPortalService>("QuotationPortalService", ["checkout", "completePayment"]);
    portal.checkout.and.resolveTo(checkout());
    portal.completePayment.and.resolveTo({ status: "PAID" });
    const component = createComponent(portal);

    await component.ngOnInit();
    expect(component.checkout()?.quotation.number).toBe("QUO-000001");
    expect(component.result()).toBeNull();

    await component.complete("PAID");
    expect(portal.completePayment).toHaveBeenCalledWith("checkout-token", "PAID");
    expect(component.result()).toBe("PAID");
    expect(component.processing()).toBeFalse();
  });

  it("shows an unavailable state without leaving the loader active", async () => {
    const portal = jasmine.createSpyObj<QuotationPortalService>("QuotationPortalService", ["checkout", "completePayment"]);
    portal.checkout.and.rejectWith(new Error("unavailable"));
    const component = createComponent(portal);

    await component.ngOnInit();
    expect(component.error()).toContain("pago");
    expect(component.loading()).toBeFalse();
  });

  it("loads a disabled-gateway checkout without claiming sandbox", async () => {
    const portal = jasmine.createSpyObj<QuotationPortalService>("QuotationPortalService", ["checkout", "completePayment"]);
    portal.checkout.and.resolveTo(checkout({ mode: "disabled", sandbox: false }));
    const component = createComponent(portal);

    await component.ngOnInit();
    expect(component.checkout()?.mode).toBe("disabled");
    expect(component.result()).toBeNull();
  });
});

function createComponent(portal: jasmine.SpyObj<QuotationPortalService>): PaymentCheckoutComponent {
  return new PaymentCheckoutComponent(
    { snapshot: { paramMap: { get: () => "checkout-token" } } } as unknown as ActivatedRoute,
    portal,
    { getLocale: () => "es" } as unknown as LocaleService
  );
}

function checkout(overrides: Partial<PublicPaymentCheckout> = {}): PublicPaymentCheckout {
  return {
    payment: { status: "PENDING", amount: "1190.00", currency: "CLP", createdAt: "2026-07-17T12:00:00.000Z" },
    quotation: { number: "QUO-000001", version: 1, clientName: "Cliente Demo" },
    organization: { name: "Kaklen Demo" },
    mode: "sandbox",
    sandbox: true,
    ...overrides
  };
}
