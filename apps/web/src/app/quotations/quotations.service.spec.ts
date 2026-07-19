import { provideHttpClient } from "@angular/common/http";
import { provideHttpClientTesting, HttpTestingController } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { QuotationsService } from "./quotations.service";

describe("QuotationsService documents", () => {
  let service: QuotationsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(QuotationsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it("downloads an authenticated PDF blob and parses its filename", async () => {
    const promise = service.downloadPdf("org-1", "quotation-1", "pt-BR");
    const request = http.expectOne((candidate) => candidate.url.endsWith("/organizations/org-1/quotations/quotation-1/pdf"));
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.params.get("locale")).toBe("pt-BR");
    expect(request.request.responseType).toBe("blob");
    request.flush(new Blob(["%PDF-test"], { type: "application/pdf" }), {
      headers: { "Content-Disposition": 'attachment; filename="cotacao-quo-000001-v1.pdf"' }
    });

    const result = await promise;
    expect(result.blob.type).toBe("application/pdf");
    expect(result.filename).toBe("cotacao-quo-000001-v1.pdf");
  });

  it("posts the localized email payload with credentials", async () => {
    const payload = { to: "client@example.com", subject: "Quotation", message: "Please review", locale: "en" as const };
    const promise = service.sendEmail("org-1", "quotation-1", payload);
    const request = http.expectOne((candidate) => candidate.url.endsWith("/organizations/org-1/quotations/quotation-1/email"));
    expect(request.request.method).toBe("POST");
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.body).toEqual(payload);
    request.flush({ id: "quotation-1" });
    await promise;
  });

  it("posts an explicit total recalculation with credentials", async () => {
    const promise = service.recalculateTotals("org-1", "quotation-1");
    const request = http.expectOne((candidate) =>
      candidate.url.endsWith("/organizations/org-1/quotations/quotation-1/recalculate-totals")
    );
    expect(request.request.method).toBe("POST");
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.body).toEqual({});
    request.flush({ id: "quotation-1", total: "1190" });

    await expectAsync(promise).toBeResolved();
  });
});
