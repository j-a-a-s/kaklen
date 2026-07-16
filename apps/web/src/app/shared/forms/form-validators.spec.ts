import { FormControl, FormGroup } from "@angular/forms";
import {
  FIELD_LIMITS,
  dateOrderValidator,
  decimalValidator,
  emailValidator,
  internationalPhoneValidator,
  normalizeEmail,
  normalizePhone,
  trimmedRequired
} from "./form-validators";
import { FormErrorSummaryComponent } from "./form-feedback.components";

describe("shared form validation", () => {
  it("normalizes and validates email addresses against the database limit", () => {
    const control = new FormControl("  Ada@Example.COM  ", emailValidator(true));
    expect(control.valid).toBeTrue();
    expect(normalizeEmail(control.value ?? "")).toBe("ada@example.com");

    control.setValue("not-an-email");
    expect(control.hasError("email")).toBeTrue();
    control.setValue(`${"a".repeat(FIELD_LIMITS.email)}@example.com`);
    expect(control.hasError("maxlength")).toBeTrue();
  });

  it("accepts visual phone separators and rejects letters or invalid Chilean lengths", () => {
    const country = () => "CL";
    const control = new FormControl("+56 9 1234-5678", internationalPhoneValidator({ country }));
    expect(control.valid).toBeTrue();
    expect(normalizePhone(control.value ?? "")).toBe("+56912345678");

    control.setValue("+56 call-me");
    expect(control.hasError("phone")).toBeTrue();
    control.setValue("1234");
    expect(control.hasError("phone")).toBeTrue();
  });

  it("validates exact decimal precision and domain ranges", () => {
    const control = new FormControl("10.25", decimalValidator(0, 100, 2));
    expect(control.valid).toBeTrue();
    control.setValue("10.256");
    expect(control.hasError("precision")).toBeTrue();
    control.setValue("-1");
    expect(control.hasError("min")).toBeTrue();
    control.setValue("letters");
    expect(control.hasError("decimal")).toBeTrue();
  });

  it("rejects whitespace-only required text", () => {
    const control = new FormControl("   ", trimmedRequired());
    expect(control.hasError("whitespace")).toBeTrue();
    control.setValue("Kaklen");
    expect(control.valid).toBeTrue();
  });

  it("validates quotation and event date order", () => {
    const form = new FormGroup({
      start: new FormControl("2026-08-10"),
      end: new FormControl("2026-08-09")
    }, dateOrderValidator("start", "end"));
    expect(form.hasError("dateOrder")).toBeTrue();
    form.controls.end.setValue("2026-08-10");
    expect(form.valid).toBeTrue();

    form.setValidators(dateOrderValidator("start", "end", false));
    form.updateValueAndValidity();
    expect(form.hasError("dateOrder")).toBeTrue();
  });

  it("summarizes invalid fields with human labels", () => {
    const summary = new FormErrorSummaryComponent();
    summary.form = new FormGroup({
      name: new FormControl("", trimmedRequired()),
      email: new FormControl("invalid", emailValidator())
    });
    summary.labels = { name: "Nombre", email: "Email" };
    summary.submitted = true;

    expect(summary.visible).toBeTrue();
    expect(summary.title).toContain("2");
    expect(summary.description).toBe("Nombre, Email");
  });
});
