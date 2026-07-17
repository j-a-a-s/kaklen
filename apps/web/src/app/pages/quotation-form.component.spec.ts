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
    expect(component.stepError()).toBe("");
  });
});
