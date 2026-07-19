import { HttpErrorResponse } from "@angular/common/http";
import { ActivatedRoute, convertToParamMap, Router } from "@angular/router";
import { BehaviorSubject } from "rxjs";
import { AssistantService } from "../assistant/assistant.service";
import { ProductAnalyticsService } from "../assistant/product-analytics.service";
import { LocaleService } from "../i18n/locale.service";
import { OrganizationService } from "../organizations/organization.service";
import { Quotation, QuotationChangeRequest } from "../quotations/quotation.models";
import { QuotationsService } from "../quotations/quotations.service";
import { NotificationService } from "../shared/notifications/notification.service";
import { QuotationDetailComponent } from "./quotation-detail.component";

describe("QuotationDetailComponent", () => {
  it("loads quotation, history, and customer change requests together", async () => {
    const context = createContext();

    await context.component.ngOnInit();

    expect(context.quotations.get).toHaveBeenCalledOnceWith("organization-1", "quotation-1");
    expect(context.quotations.history).toHaveBeenCalledOnceWith("organization-1", "quotation-1");
    expect(context.quotations.changeRequests).toHaveBeenCalledOnceWith("organization-1", "quotation-1");
    expect(context.component.changeRequests()[0]).toEqual(changeRequest());
    expect(context.component.changeRequests()[0].comment).toBe("<strong>Solicito descuentos</strong>\nSegunda línea");
    expect(context.component.changeRequests()[0].quotationVersion).toBe(2);
    expect(context.component.changeRequests()[0].items[0]?.name).toBe("Producción integral de eventos");
    context.component.ngOnDestroy();
  });

  it("focuses and highlights change requests when a deep link fragment arrives", async () => {
    const context = createContext(null);
    const section = document.createElement("section");
    section.id = "change-requests";
    const scrollIntoView = jasmine.createSpy("scrollIntoView");
    section.scrollIntoView = scrollIntoView;
    document.body.appendChild(section);
    spyOn(window, "requestAnimationFrame").and.callFake((callback) => {
      callback(0);
      return 1;
    });

    await context.component.ngOnInit();
    expect(scrollIntoView).not.toHaveBeenCalled();

    context.fragment.next("change-requests");
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(context.component.changeRequestsHighlighted()).toBeTrue();

    context.component.changeRequestsHighlighted.set(false);
    context.component.ngOnDestroy();
    section.remove();
  });

  it("exposes new-version access only through quotation update permission", () => {
    const allowed = createContext(null, true).component;
    const denied = createContext(null, false).component;

    expect(allowed.canUpdate()).toBeTrue();
    expect(denied.canUpdate()).toBeFalse();
  });

  it("shows the localized parity error without retaining contradictory totals", async () => {
    const context = createContext(null);
    context.component.quotation.set(quotation());
    context.quotations.get.and.rejectWith(new HttpErrorResponse({
      status: 409,
      error: {
        code: "QUOTATION_MONEY_MISMATCH",
        message: "Quotation totals are inconsistent.",
        field: "total",
        resourceId: "quotation-1",
        repairable: true
      }
    }));

    await context.component.ngOnInit();

    expect(context.component.error()).toBe("Detectamos una inconsistencia financiera.");
    expect(context.component.integrityIssue()).toEqual(jasmine.objectContaining({
      field: "total",
      resourceId: "quotation-1",
      repairable: true
    }));
    expect(context.component.canRepairIntegrityIssue()).toBeTrue();
    expect(context.component.quotation()).toBeNull();
    expect(context.component.calculatedAmounts()).toBeNull();
    expect(context.component.history()).toEqual([]);
    expect(context.component.changeRequests()).toEqual([]);
    context.component.ngOnDestroy();
  });

  it("clears detail and financial actions when a status response reports a mismatch", async () => {
    const context = createContext(null);
    await context.component.ngOnInit();
    context.component.pendingStatusAction.set("approve");
    context.quotations.changeStatus.and.rejectWith(new HttpErrorResponse({
      status: 409,
      error: {
        code: "QUOTATION_MONEY_MISMATCH",
        message: "Quotation totals are inconsistent.",
        field: "items.0.total",
        resourceId: "quotation-1",
        repairable: false
      }
    }));

    await context.component.changeStatus("approve");

    expect(context.component.quotation()).toBeNull();
    expect(context.component.calculatedAmounts()).toBeNull();
    expect(context.component.history()).toEqual([]);
    expect(context.component.changeRequests()).toEqual([]);
    expect(context.component.pendingStatusAction()).toBeNull();
    expect(context.component.error()).toBe(
      "Detectamos una inconsistencia financiera. Contacta al administrador para revisarla."
    );
    expect(context.component.canRepairIntegrityIssue()).toBeFalse();
    context.component.ngOnDestroy();
  });

  it("keeps financial actions hidden until repair reloads a consistent quotation", async () => {
    const context = createContext(null);
    context.quotations.get.and.rejectWith(moneyMismatchError(true));
    await context.component.ngOnInit();
    expect(context.component.quotation()).toBeNull();

    context.quotations.recalculateTotals.and.resolveTo(quotation());
    context.quotations.get.and.resolveTo(quotation());
    const repair = context.component.recalculateTotals();
    expect(context.component.quotation()).toBeNull();
    await repair;

    expect(context.quotations.recalculateTotals).toHaveBeenCalledOnceWith("organization-1", "quotation-1");
    expect(context.component.integrityIssue()).toBeNull();
    expect(context.component.quotation()?.total).toBe("499800");
    expect(context.component.calculatedAmounts()?.total).toBe("499800");
    context.component.ngOnDestroy();
  });
});

function createContext(fragmentValue: string | null = "change-requests", canUpdate = true): {
  component: QuotationDetailComponent;
  fragment: BehaviorSubject<string | null>;
  quotations: jasmine.SpyObj<QuotationsService>;
} {
  const fragment = new BehaviorSubject<string | null>(fragmentValue);
  const quotations = jasmine.createSpyObj<QuotationsService>("QuotationsService", [
    "get", "history", "changeRequests", "changeStatus", "newVersion", "downloadPdf",
    "sendEmail", "createPublicLink", "prepareWhatsApp", "recalculateTotals"
  ]);
  quotations.get.and.resolveTo(quotation());
  quotations.history.and.resolveTo([]);
  quotations.changeRequests.and.resolveTo([changeRequest()]);
  const organization = {
    setActiveOrganization: jasmine.createSpy("setActiveOrganization").and.resolveTo(),
    hasPermission: jasmine.createSpy("hasPermission").and.callFake((permission: string) =>
      permission === "quotations.update" ? canUpdate : true
    ),
    activeOrganization: () => ({ numberFormat: "es", dateFormat: "dd-MM-yyyy", currency: "CLP" })
  } as unknown as OrganizationService;
  const component = new QuotationDetailComponent(
    {
      snapshot: {
        paramMap: convertToParamMap({ organizationId: "organization-1", quotationId: "quotation-1" })
      },
      fragment: fragment.asObservable()
    } as unknown as ActivatedRoute,
    jasmine.createSpyObj<Router>("Router", ["navigate", "navigateByUrl"]),
    organization,
    quotations,
    { getLocale: () => "es" } as LocaleService,
    jasmine.createSpyObj<NotificationService>("NotificationService", ["success", "error", "info", "fromError"]),
    { activation: async () => ({ completedSteps: [] }) } as unknown as AssistantService,
    { track: () => undefined } as unknown as ProductAnalyticsService
  );
  return { component, fragment, quotations };
}

function moneyMismatchError(repairable: boolean): HttpErrorResponse {
  return new HttpErrorResponse({
    status: 409,
    error: {
      code: "QUOTATION_MONEY_MISMATCH",
      message: "Quotation totals are inconsistent.",
      field: "total",
      resourceId: "quotation-1",
      repairable
    }
  });
}

function changeRequest(): QuotationChangeRequest {
  return {
    id: "change-1",
    quotationId: "quotation-1",
    quotationVersion: 2,
    comment: "<strong>Solicito descuentos</strong>\nSegunda línea",
    itemIndexes: [0],
    items: [{ index: 0, code: "SERV-1", name: "Producción integral de eventos" }],
    createdAt: "2026-07-17T21:44:00.000Z"
  };
}

function quotation(): Quotation {
  return {
    id: "quotation-1",
    organizationId: "organization-1",
    clientId: "client-1",
    number: "QUO-000001",
    version: 2,
    status: "CHANGES_REQUESTED",
    issueDate: "2026-07-01T00:00:00.000Z",
    validUntil: "2026-08-01T00:00:00.000Z",
    currency: "CLP",
    globalDiscountPercent: "0",
    subtotal: "420000",
    discountTotal: "0",
    taxTotal: "79800",
    total: "499800",
    notes: null,
    terms: null,
    approvedAt: null,
    rejectedAt: null,
    sentAt: "2026-07-02T00:00:00.000Z",
    paidAt: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-17T21:44:00.000Z",
    archivedAt: null,
    client: { id: "client-1", displayName: "Valentina Ríos" } as Quotation["client"],
    items: [{
      id: "item-1",
      quotationId: "quotation-1",
      catalogItemId: null,
      type: "SERVICE",
      code: "SERV-1",
      name: "Producción integral de eventos",
      description: null,
      quantity: "1",
      unit: "servicio",
      unitPrice: "420000",
      discountType: "NONE",
      discountValue: "0",
      taxPercent: "19",
      subtotal: "420000",
      discountTotal: "0",
      taxTotal: "79800",
      total: "499800",
      sortOrder: 0
    }]
  };
}
