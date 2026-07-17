import { FormControl, FormGroup, Validators } from "@angular/forms";
import { dateOrderValidator } from "./form-validators";
import { WizardValidationState } from "./wizard-validation-state";

describe("WizardValidationState", () => {
  it("marks only the active step and updates its exact errors immediately", () => {
    const form = new FormGroup({
      name: new FormControl("", Validators.required),
      email: new FormControl("", Validators.required)
    });
    const state = new WizardValidationState(form, { steps: { 1: ["name"], 2: ["email"] } });

    expect(state.attempt(1).map((error) => error.path)).toEqual(["name"]);
    expect(state.isAttempted(1)).toBeTrue();
    expect(form.controls.name.touched).toBeTrue();
    expect(form.controls.email.touched).toBeFalse();

    form.controls.name.setValue("Kaklen");
    expect(state.errors(1)).toEqual([]);
    expect(state.errors(2).map((error) => error.path)).toEqual(["email"]);
  });

  it("includes related group errors in visual order", () => {
    const form = new FormGroup({
      start: new FormControl("2026-08-10", Validators.required),
      end: new FormControl("2026-08-09", Validators.required)
    }, dateOrderValidator("start", "end"));
    const state = new WizardValidationState(form, {
      steps: { 1: ["start", "end"] },
      groupErrorFields: { dateOrder: "end" }
    });

    expect(state.attempt(1)).toEqual([{ path: "end", errors: { dateOrder: true } }]);
    form.controls.end.setValue("2026-08-11");
    expect(state.errors(1)).toEqual([]);
  });

  it("scrolls and focuses the first invalid field without a fixed delay", () => {
    const form = new FormGroup({ name: new FormControl("", Validators.required) });
    const state = new WizardValidationState(form, {
      steps: { 1: ["name"] },
      fieldIds: { name: "wizard-name" }
    });
    const input = document.createElement("input");
    input.id = "wizard-name";
    document.body.appendChild(input);
    const scroll = spyOn(input, "scrollIntoView");
    const focus = spyOn(input, "focus");
    spyOn(window, "requestAnimationFrame").and.callFake((callback) => {
      callback(0);
      return 1;
    });

    state.attempt(1);
    state.focusFirst(1);

    expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    input.remove();
  });
});
