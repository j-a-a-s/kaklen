import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { API_BASE_URL } from "../config/runtime-config";
import { QuotationPortalService } from "./quotation-portal.service";

describe("QuotationPortalService", () => {
  let service: QuotationPortalService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(QuotationPortalService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it("loads an isolated public quotation without authenticated storage", async () => {
    const promise = service.view("public-token");
    const request = http.expectOne(`${API_BASE_URL}/portal/quotations/public-token`);
    expect(request.request.method).toBe("GET");
    expect(request.request.withCredentials).toBeFalse();
    request.flush({ quotation: { number: "QUO-1" } });
    await expectAsync(promise).toBeResolved();
  });

  it("submits a change request with selected item indexes", async () => {
    const promise = service.requestChanges("public-token", "Adjust delivery", [1, 3]);
    const request = http.expectOne(`${API_BASE_URL}/portal/quotations/public-token/change-requests`);
    expect(request.request.method).toBe("POST");
    expect(request.request.body).toEqual({ comment: "Adjust delivery", itemIndexes: [1, 3] });
    request.flush({ status: "CHANGES_REQUESTED" });
    await expectAsync(promise).toBeResolvedTo({ status: "CHANGES_REQUESTED" });
  });

  it("keeps payment idempotency and provider consent in explicit payloads", async () => {
    const payment = service.createPayment("public-token", "idempotency-key", "pt-BR");
    const paymentRequest = http.expectOne(`${API_BASE_URL}/portal/quotations/public-token/payments`);
    expect(paymentRequest.request.body).toEqual({ idempotencyKey: "idempotency-key", locale: "pt-BR" });
    paymentRequest.flush({ paymentId: "payment-1", status: "PENDING", checkoutUrl: "/checkout", amount: "100", currency: "CLP" });
    await payment;

    const profile = service.createProviderProfile("public-token", {
      consent: true,
      category: "Photography",
      description: "Professional event photography",
      country: "CL",
      whatsapp: "+56912345678",
      currency: "CLP"
    });
    const profileRequest = http.expectOne(`${API_BASE_URL}/portal/quotations/public-token/provider-profile`);
    expect(profileRequest.request.body).toEqual(jasmine.objectContaining({ consent: true, category: "Photography" }));
    profileRequest.flush({ status: "PENDING_REVIEW" });
    await profile;
  });
});
