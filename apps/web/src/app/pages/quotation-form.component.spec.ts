import { QuotationFormComponent } from "./quotation-form.component";

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
});
