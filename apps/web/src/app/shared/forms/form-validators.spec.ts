import { FormControl, FormGroup } from "@angular/forms";
import {
  FIELD_LIMITS,
  dateOrderValidator,
  decimalValidator,
  emailValidator,
  internationalPhoneValidator,
  moneyValidator,
  normalizeEmail,
  normalizePhone,
  trimmedRequired
} from "./form-validators";
import { FormErrorSummaryComponent } from "./form-feedback.components";
import { resolveValidationLabel, validationMessageResolver } from "./validation-message-resolver";

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

  it("enforces editable money precision without rounding or accepting scale-only decimals", () => {
    let currency = "CLP";
    const control = new FormControl("1000", moneyValidator(() => currency, () => "2000"));
    expect(control.valid).toBeTrue();

    control.setValue("1000.00");
    expect(control.getError("precision")).toEqual({ maxDecimalPlaces: 0, currency: "CLP" });
    control.setValue("1000.50");
    expect(control.hasError("precision")).toBeTrue();

    currency = "USD";
    control.updateValueAndValidity();
    expect(control.valid).toBeTrue();
    control.setValue("1000.001");
    expect(control.getError("precision")).toEqual({ maxDecimalPlaces: 2, currency: "USD" });
    control.setValue("2000.01");
    expect(control.hasError("max")).toBeTrue();
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
    summary.attempted = true;
    summary.scopePaths = ["email"];

    expect(summary.visible).toBeTrue();
    expect(summary.title).toContain("Corrige");
    expect(summary.description).toBe("Email");
    expect(summary.entries.map((entry) => entry.message)).toEqual([
      "Ingresa un correo válido, por ejemplo nombre@empresa.cl."
    ]);
  });

  it("resolves precise validation rules from a single source", () => {
    const control = new FormControl("10.256", decimalValidator(0, 100, 2));
    expect(validationMessageResolver.resolve({
      path: "price",
      label: "Precio",
      errors: control.errors,
      control,
      currency: "USD"
    })).toBe("Ingresa un monto mayor o igual a 0 con máximo 2 decimales.");

    const text = new FormControl("x", { validators: [] });
    text.setErrors({ maxlength: { requiredLength: 80, actualLength: 81 } });
    expect(validationMessageResolver.resolve({ path: "name", label: "Nombre", errors: text.errors, control: text }))
      .toBe("Puedes ingresar como máximo 80 caracteres.");
  });

  it("renders human one-based labels for nested form arrays", () => {
    expect(resolveValidationLabel("items.0.quantity")).toBe("Ítem 1: Cantidad");
    expect(resolveValidationLabel("participants.1.email")).toBe("Participante 2: Email");
    expect(resolveValidationLabel("tasks.2.title")).toBe("Tarea 3: Título");
    expect(resolveValidationLabel("resources.0.quantity")).toBe("Recurso 1: Cantidad");
  });
});
