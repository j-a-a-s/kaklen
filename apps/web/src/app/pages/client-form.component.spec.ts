import { ClientFormComponent } from "./client-form.component";

describe("ClientFormComponent wizard validation", () => {
  function createComponent(): ClientFormComponent {
    return new ClientFormComponent(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );
  }

  it("keeps the identity step visible and identifies the first exact field", () => {
    const component = createComponent();

    component.nextStep();

    expect(component.currentStep()).toBe(1);
    expect(component.wizardValidation.isAttempted(1)).toBeTrue();
    expect(component.wizardValidation.firstError(1)?.path).toBe("firstName");
  });

  it("updates dynamic Chilean RUT and WhatsApp requirements", () => {
    const component = createComponent();
    component.clientForm.patchValue({ firstName: "Ada", lastName: "Lovelace", taxId: "12.345.678-5" });

    component.nextStep();
    expect(component.currentStep()).toBe(2);
    component.nextStep();
    expect(component.wizardValidation.firstError(2)?.path).toBe("whatsapp");

    component.previousStep();
    component.clientForm.controls.country.setValue("US");
    component.clientForm.controls.taxId.setValue("");
    component.nextStep();
    expect(component.currentStep()).toBe(2);
  });
});
