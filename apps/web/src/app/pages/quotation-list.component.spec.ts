import { HttpErrorResponse } from "@angular/common/http";
import { ActivatedRoute } from "@angular/router";
import { OrganizationService } from "../organizations/organization.service";
import { Quotation, QuotationSummary } from "../quotations/quotation.models";
import { QuotationsService } from "../quotations/quotations.service";
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
    const quotationsService = jasmine.createSpyObj<QuotationsService>("QuotationsService", ["summary", "list"]);
    quotationsService.summary.and.resolveTo(quotationSummary());
    quotationsService.list.and.rejectWith(moneyMismatchError());
    const component = createComponent(quotationsService);
    component.summary.set(quotationSummary());
    component.quotations.set({ items: [{} as Quotation], page: 1, pageSize: 20, total: 1, totalPages: 1 });

    await component.load(2);

    expect(component.summary()).toBeNull();
    expect(component.quotations()).toEqual({ items: [], page: 2, pageSize: 20, total: 0, totalPages: 0 });
    expect(component.error()).toBe(
      "Los totales de la cotización no coinciden. Debes recalcularla y guardarla antes de continuar."
    );
  });
});

function createComponent(quotationsService = {} as QuotationsService): QuotationListComponent {
  return new QuotationListComponent(
    {} as ActivatedRoute,
    {
      activeOrganization: () => ({ currency: "CLP", numberFormat: "es" })
    } as unknown as OrganizationService,
    quotationsService
  );
}

function moneyMismatchError(): HttpErrorResponse {
  return new HttpErrorResponse({
    status: 409,
    error: {
      code: "QUOTATION_MONEY_MISMATCH",
      message: "Quotation totals are inconsistent.",
      field: "total"
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
