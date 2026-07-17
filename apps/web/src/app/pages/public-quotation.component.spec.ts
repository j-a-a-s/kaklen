import { ActivatedRoute } from "@angular/router";
import { LocaleService } from "../i18n/locale.service";
import { PublicQuotationView } from "../portal/quotation-portal.models";
import { QuotationPortalService } from "../portal/quotation-portal.service";
import { PublicQuotationComponent } from "./public-quotation.component";

describe("PublicQuotationComponent", () => {
  it("loads an obsolete version as read-only", async () => {
    const portal = portalSpy();
    portal.view.and.resolveTo(view({ isLatestVersion: false, canRequestChanges: false, canApproveAndPay: false }));
    const component = createComponent(portal);

    await component.ngOnInit();
    expect(component.view()?.quotation.isLatestVersion).toBeFalse();
    expect(component.view()?.actions.canRequestChanges).toBeFalse();
    expect(component.view()?.actions.canApproveAndPay).toBeFalse();
  });

  it("submits a specific change request and reloads the quotation", async () => {
    const portal = portalSpy();
    portal.view.and.resolveTo(view());
    portal.requestChanges.and.resolveTo({ status: "CHANGES_REQUESTED" });
    const component = createComponent(portal);
    await component.ngOnInit();
    component.changesForm.controls.comment.setValue("Please adjust the first item");
    component.toggleItem(0);

    await component.submitChanges();
    expect(portal.requestChanges).toHaveBeenCalledWith(
      "public-token",
      "Please adjust the first item",
      [0]
    );
    expect(portal.view).toHaveBeenCalledTimes(2);
  });

  it("prefills confirmed data only after consent and reports profile submission", async () => {
    const portal = portalSpy();
    portal.view.and.resolveTo(view({ canOfferServices: true }));
    portal.createProviderProfile.and.resolveTo({ status: "PENDING_REVIEW" });
    const component = createComponent(portal);
    await component.ngOnInit();
    expect(component.providerForm.controls.whatsapp.value).toBe("");

    component.providerForm.patchValue({
      consent: true,
      category: "Photography",
      description: "Professional photography for events",
      whatsapp: "+56912345678"
    });
    component.applyConsentPrefill();
    await component.submitProvider();

    expect(portal.createProviderProfile).toHaveBeenCalledWith(
      "public-token",
      jasmine.objectContaining({ consent: true, whatsapp: "+56912345678" })
    );
    expect(component.providerSuccess()).toBeTrue();
    expect(component.providerOpen()).toBeFalse();
  });
});

function portalSpy(): jasmine.SpyObj<QuotationPortalService> {
  return jasmine.createSpyObj<QuotationPortalService>("QuotationPortalService", [
    "view",
    "requestChanges",
    "createPayment",
    "recommendationShown",
    "createProviderProfile"
  ]);
}

function createComponent(portal: jasmine.SpyObj<QuotationPortalService>): PublicQuotationComponent {
  return new PublicQuotationComponent(
    { snapshot: { paramMap: { get: () => "public-token" } } } as unknown as ActivatedRoute,
    portal,
    { getLocale: () => "es" } as unknown as LocaleService
  );
}

function view(options: {
  isLatestVersion?: boolean;
  canRequestChanges?: boolean;
  canApproveAndPay?: boolean;
  canOfferServices?: boolean;
} = {}): PublicQuotationView {
  return {
    organization: { name: "Kaklen Demo", legalName: null, taxId: null, address: null, phone: null, whatsapp: null, country: "CL" },
    client: { displayName: "Cliente Demo", legalName: null, taxId: "11111111-1", email: null, whatsapp: "+56912345678", address: null },
    quotation: {
      number: "QUO-000001",
      version: 1,
      latestVersion: options.isLatestVersion === false ? 2 : 1,
      isLatestVersion: options.isLatestVersion ?? true,
      status: "SENT",
      issueDate: "2026-07-01T12:00:00.000Z",
      validUntil: "2026-07-31T12:00:00.000Z",
      currency: "CLP",
      subtotal: "1000.00",
      discountTotal: "0.00",
      taxTotal: "190.00",
      total: "1190.00",
      notes: null,
      terms: null,
      items: [{ index: 0, code: "SERV-1", name: "Service", description: null, quantity: "1", unit: "unit", unitPrice: "1000", discountType: "NONE", discountValue: "0", taxPercent: "19", total: "1190" }],
      history: []
    },
    link: { expiresAt: "2026-08-01T12:00:00.000Z" },
    actions: {
      canRequestChanges: options.canRequestChanges ?? true,
      canApproveAndPay: options.canApproveAndPay ?? true,
      canOfferServices: options.canOfferServices ?? false
    }
  };
}
