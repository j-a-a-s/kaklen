import { EventFormComponent } from "./event-form.component";

describe("EventFormComponent wizard validation", () => {
  function createComponent(): EventFormComponent {
    return new EventFormComponent(
      {} as never, {} as never, {} as never, {} as never, {} as never,
      {} as never, {} as never, {} as never, {} as never
    );
  }

  it("requires the selected quotation only in quotation mode", () => {
    const component = createComponent();
    component.form.controls.name.setValue("Launch");

    component.setCreationMode("quotation");
    component.nextStep();
    expect(component.currentStep()).toBe(1);
    expect(component.wizardValidation.firstError(1)?.path).toBe("quotationId");

    component.setCreationMode("manual");
    component.nextStep();
    expect(component.currentStep()).toBe(2);
  });

  it("reports the end date and does not reveal the next step for an invalid range", () => {
    const component = createComponent();
    component.form.patchValue({
      name: "Launch",
      startAt: "2026-08-10T10:00",
      endAt: "2026-08-10T09:00",
      timezone: "America/Santiago"
    });
    component.nextStep();
    component.nextStep();

    expect(component.currentStep()).toBe(2);
    expect(component.wizardValidation.firstError(2)?.path).toBe("endAt");
  });
});
