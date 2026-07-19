import { HttpErrorResponse } from "@angular/common/http";
import { ActivatedRoute } from "@angular/router";
import { OrganizationService } from "../organizations/organization.service";
import { Quotation, QuotationSummary } from "../quotations/quotation.models";
import { QuotationsService } from "../quotations/quotations.service";
import { NotificationService } from "../shared/notifications/notification.service";
import { QuotationListComponent } from "./quotation-list.component";

describe("QuotationListComponent", () => {
  it("presents base and foreign approved currencies without consolidating them", () => {
    const component = createComponent();
    const summary = quotationSummary();

    expect(component.baseApprovedAmountLabel(summary)).toBe("$150.000 CLP");
    expect(component.otherApprovedAmounts(summary).map((item) => component.approvedAmountLabel(item))).toEqual([
      "BRL 800,00",
      "EUR 100,50",
      "USD 500,25"
    ]);
    expect(component.otherApprovedAmounts(summary).map((item) => item.amount)).not.toContain("151400.75");
  });

  it("shows an exact zero in the base currency when there are no approvals", () => {
    const component = createComponent();
    const summary = quotationSummary({ approvedAmounts: [], baseCurrencyApprovedAmount: "0" });

    expect(component.baseApprovedAmountLabel(summary)).toBe("$0 CLP");
    expect(component.otherApprovedAmounts(summary)).toEqual([]);
  });

  it("clears previous rows and summary when list parity fails", async () => {
    const quotationsService = jasmine.createSpyObj<QuotationsService>("QuotationsService", ["summary", "list", "recalculateTotals"]);
    quotationsService.summary.and.resolveTo(quotationSummary());
    quotationsService.list.and.rejectWith(moneyMismatchError());
    const component = createComponent(quotationsService);
    component.summary.set(quotationSummary());
    component.quotations.set({ items: [{} as Quotation], page: 1, pageSize: 20, total: 1, totalPages: 1 });

    await component.load(2);

    expect(component.summary()).toBeNull();
    expect(component.quotations()).toEqual({ items: [], page: 2, pageSize: 20, total: 0, totalPages: 0 });
    expect(component.error()).toBe("Detectamos una inconsistencia financiera.");
    expect(component.integrityIssue()).toEqual(jasmine.objectContaining({
      field: "total",
      resourceId: "quotation-1",
      repairable: true
    }));
    expect(component.canRepairIntegrityIssue()).toBeTrue();
  });

  it("keeps all rows and summary hidden until repair reloads consistent data", async () => {
    const quotationsService = jasmine.createSpyObj<QuotationsService>("QuotationsService", ["summary", "list", "recalculateTotals"]);
    quotationsService.summary.and.resolveTo(quotationSummary());
    quotationsService.list.and.rejectWith(moneyMismatchError());
    quotationsService.recalculateTotals.and.resolveTo({} as Quotation);
    const component = createComponent(quotationsService);
    await component.load(1);

    expect(component.summary()).toBeNull();
    expect(component.quotations().items).toEqual([]);

    quotationsService.list.and.resolveTo({ items: [{} as Quotation], page: 1, pageSize: 20, total: 1, totalPages: 1 });
    await component.recalculateTotals();

    expect(quotationsService.recalculateTotals).toHaveBeenCalledOnceWith("", "quotation-1");
    expect(component.integrityIssue()).toBeNull();
    expect(component.summary()).toEqual(quotationSummary());
    expect(component.quotations().items).toHaveSize(1);
  });

  it("directs non-repairable inconsistencies to an administrator", async () => {
    const quotationsService = jasmine.createSpyObj<QuotationsService>("QuotationsService", ["summary", "list", "recalculateTotals"]);
    quotationsService.summary.and.rejectWith(moneyMismatchError(false));
    quotationsService.list.and.resolveTo({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 });
    const component = createComponent(quotationsService);

    await component.load(1);

    expect(component.error()).toBe("Detectamos una inconsistencia financiera. Contacta al administrador para revisarla.");
    expect(component.canRepairIntegrityIssue()).toBeFalse();
  });

  it("closes the repair modal and keeps list money hidden when repair is impossible", async () => {
    const quotationsService = jasmine.createSpyObj<QuotationsService>("QuotationsService", ["summary", "list", "recalculateTotals"]);
    quotationsService.summary.and.resolveTo(quotationSummary());
    quotationsService.list.and.rejectWith(moneyMismatchError());
    quotationsService.recalculateTotals.and.rejectWith(repairNotPossibleError());
    const notifications = jasmine.createSpyObj<NotificationService>("NotificationService", ["success", "fromError"]);
    const component = createComponent(quotationsService, notifications);
    await component.load(1);
    component.repairConfirmationOpen.set(true);

    await component.recalculateTotals();

    expect(component.repairConfirmationOpen()).toBeFalse();
    expect(component.canRepairIntegrityIssue()).toBeFalse();
    expect(component.summary()).toBeNull();
    expect(component.quotations().items).toEqual([]);
    expect(component.error()).toBe(
      "Detectamos una inconsistencia financiera. Contacta al administrador para revisarla."
    );
    expect(notifications.fromError).not.toHaveBeenCalled();
  });
});

function createComponent(
  quotationsService = {} as QuotationsService,
  notifications = jasmine.createSpyObj<NotificationService>("NotificationService", ["success", "fromError"])
): QuotationListComponent {
  return new QuotationListComponent(
    {} as ActivatedRoute,
    {
      activeOrganization: () => ({ currency: "CLP", numberFormat: "es" }),
      hasPermission: () => true
    } as unknown as OrganizationService,
    quotationsService,
    notifications
  );
}

function moneyMismatchError(repairable = true): HttpErrorResponse {
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

function repairNotPossibleError(): HttpErrorResponse {
  return new HttpErrorResponse({
    status: 409,
    error: {
      code: "QUOTATION_MONEY_REPAIR_NOT_POSSIBLE",
      message: "Quotation source data cannot be recalculated safely.",
      field: "items.0.unitPrice",
      resourceId: "quotation-1",
      repairable: false
    }
  });
}

function quotationSummary(overrides: Partial<QuotationSummary> = {}): QuotationSummary {
  return {
    total: 5,
    draft: 0,
    sent: 0,
    changesRequested: 0,
    approved: 5,
    rejected: 0,
    expired: 0,
    cancelled: 0,
    baseCurrency: "CLP",
    baseCurrencyApprovedAmount: "150000",
    approvedAmounts: [
      { currency: "CLP", amount: "150000", quotationCount: 2 },
      { currency: "BRL", amount: "800.00", quotationCount: 1 },
      { currency: "EUR", amount: "100.50", quotationCount: 1 },
      { currency: "USD", amount: "500.25", quotationCount: 1 }
    ],
    ...overrides
  };
}
