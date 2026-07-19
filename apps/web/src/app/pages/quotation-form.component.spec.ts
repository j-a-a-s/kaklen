import { HttpErrorResponse } from "@angular/common/http";
import { QuotationFormComponent } from "./quotation-form.component";
import { convertToParamMap } from "@angular/router";
import { BehaviorSubject } from "rxjs";

describe("QuotationFormComponent", () => {
  it("allows the adjustments step when a NONE discount keeps its value disabled", () => {
    const component = new QuotationFormComponent(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );
    component.addItem();
    component.items.at(0).patchValue({
      name: "Service",
      quantity: 1,
      unit: "unit",
      unitPrice: 25_000,
      discountType: "NONE",
      discountValue: 0,
      taxPercent: 19
    });
    component.form.controls.globalDiscountPercent.setValue(5);
    component.currentStep.set(3);

    component.nextStep();

    expect(component.items.at(0).controls.discountValue.disabled).toBeTrue();
    expect(component.currentStep()).toBe(4);
    expect(component.wizardValidation.errors(3)).toEqual([]);
  });

  it("keeps the date step visible and reports validUntil for an invalid range", () => {
    const component = new QuotationFormComponent(
      {} as never, {} as never, {} as never, {} as never, {} as never,
      {} as never, {} as never, {} as never, {} as never
    );
    component.addItem();
    component.items.at(0).patchValue({ name: "Service", quantity: 1, unit: "unit", unitPrice: 100, taxPercent: 19 });
    component.form.patchValue({ issueDate: "2026-08-10", validUntil: "2026-08-09" });
    component.currentStep.set(3);

    component.nextStep();

    expect(component.currentStep()).toBe(3);
    expect(component.wizardValidation.firstError(3)?.path).toBe("validUntil");
  });

  it("keeps the requested client synchronized when Angular reuses the route", async () => {
    const queryParams = new BehaviorSubject(convertToParamMap({ clientId: "client-a" }));
    const component = new QuotationFormComponent(
      {
        snapshot: { paramMap: convertToParamMap({ organizationId: "organization-a" }) },
        queryParamMap: queryParams.asObservable()
      } as never,
      {} as never,
      { list: async () => ({ items: [] }) } as never,
      { list: async () => ({ items: [] }) } as never,
      {
        setActiveOrganization: async () => undefined,
        activeOrganization: () => ({ currency: "CLP" })
      } as never,
      {} as never,
      {} as never,
      { activation: async () => ({ completedSteps: [] }) } as never,
      { track: () => undefined } as never
    );

    await component.ngOnInit();
    expect(component.form.controls.clientId.value).toBe("client-a");

    queryParams.next(convertToParamMap({ clientId: "client-b" }));
    expect(component.form.controls.clientId.value).toBe("client-b");

    queryParams.next(convertToParamMap({}));
    expect(component.form.controls.clientId.value).toBe("");
    component.ngOnDestroy();
    expect(queryParams.observed).toBeFalse();
  });

  it("blocks edit amounts and actions when persisted parity fails", async () => {
    const queryParams = new BehaviorSubject(convertToParamMap({}));
    const quotations = jasmine.createSpyObj("QuotationsService", ["get"]);
    quotations.get.and.rejectWith(new HttpErrorResponse({
      status: 409,
      error: { code: "QUOTATION_MONEY_MISMATCH", message: "Quotation totals are inconsistent.", field: "total" }
    }));
    const component = new QuotationFormComponent(
      {
        snapshot: { paramMap: convertToParamMap({ organizationId: "organization-a", quotationId: "quotation-a" }) },
        queryParamMap: queryParams.asObservable()
      } as never,
      {} as never,
      { list: async () => ({ items: [] }) } as never,
      { list: async () => ({ items: [] }) } as never,
      {
        setActiveOrganization: async () => undefined,
        activeOrganization: () => ({ currency: "CLP" })
      } as never,
      quotations,
      jasmine.createSpyObj("NotificationService", ["success", "fromError"]) as never,
      {} as never,
      {} as never
    );

    await component.ngOnInit();

    expect(component.financialDataBlocked()).toBeTrue();
    expect(component.items.length).toBe(0);
    expect(component.error()).toBe(
      "Los totales de la cotización no coinciden. Debes recalcularla y guardarla antes de continuar."
    );
    component.ngOnDestroy();
  });

  for (const fixture of [
    {
      name: "without discounts",
      globalDiscount: "0",
      lineDiscount: false,
      expected: {
        subtotal: "1413100",
        lineDiscountTotal: "0",
        globalDiscountTotal: "0",
        discountTotal: "0",
        taxableBase: "1413100",
        taxTotal: "268489",
        total: "1681589",
        lineTotals: ["499800", "618800", "562989"]
      }
    },
    {
      name: "with a one percent overall discount",
      globalDiscount: "1",
      lineDiscount: false,
      expected: {
        subtotal: "1413100",
        lineDiscountTotal: "0",
        globalDiscountTotal: "14131",
        discountTotal: "14131",
        taxableBase: "1398969",
        taxTotal: "265804",
        total: "1664773",
        lineTotals: ["494802", "612612", "557359"]
      }
    },
    {
      name: "with a five percent line discount followed by one percent overall",
      globalDiscount: "1",
      lineDiscount: true,
      expected: {
        subtotal: "1413100",
        lineDiscountTotal: "26000",
        globalDiscountTotal: "13871",
        discountTotal: "39871",
        taxableBase: "1373229",
        taxTotal: "260913",
        total: "1634142",
        lineTotals: ["494802", "581981", "557359"]
      }
    }
  ]) {
    it(`reconciles the exact CLP fixture ${fixture.name}`, () => {
      const component = quotationComponent();
      addExactClpFixture(component, fixture.lineDiscount);
      component.form.controls.globalDiscountPercent.setValue(fixture.globalDiscount);

      expect({
        subtotal: component.subtotal(),
        lineDiscountTotal: component.lineDiscountTotal(),
        globalDiscountTotal: component.globalDiscountTotal(),
        discountTotal: component.discountTotal(),
        taxableBase: component.taxableBase(),
        taxTotal: component.taxTotal(),
        total: component.grandTotal(),
        lineTotals: component.items.controls.map((_item, index) => component.itemAmounts(index).total)
      }).toEqual(fixture.expected);
    });
  }
});

function quotationComponent(): QuotationFormComponent {
  return new QuotationFormComponent(
    {} as never, {} as never, {} as never, {} as never, {} as never,
    {} as never, {} as never, {} as never, {} as never
  );
}

function addExactClpFixture(component: QuotationFormComponent, lineDiscount: boolean): void {
  component.form.controls.currency.setValue("CLP");
  const items = [
    { name: "Pantalla LED P3", quantity: "2", unitPrice: "210000" },
    { name: "Producción integral de eventos", quantity: "1", unitPrice: "520000" },
    { name: "Catering para invitados", quantity: "19", unitPrice: "24900" }
  ];
  for (const [index, value] of items.entries()) {
    component.addItem();
    component.items.at(index).patchValue({
      ...value,
      unit: "unidad",
      taxPercent: "19",
      discountType: index === 1 && lineDiscount ? "PERCENTAGE" : "NONE",
      discountValue: index === 1 && lineDiscount ? "5" : "0"
    });
    component.updateDiscountValidators(index);
  }
  component.onCurrencyChange();
}
