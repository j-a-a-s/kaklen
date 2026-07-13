import { AbstractControl, ValidationErrors, ValidatorFn } from "@angular/forms";

const RUT_PATTERN = /^\d{1,8}[0-9K]$/;

export function normalizeChileanRut(value: string | null | undefined): string {
  return (value ?? "").replace(/[.\-\s]/g, "").toUpperCase();
}

export function formatChileanRut(value: string | null | undefined): string {
  const normalized = normalizeChileanRut(value);
  if (!normalized) {
    return "";
  }

  const body = normalized.slice(0, -1);
  const verifier = normalized.slice(-1);
  const groups: string[] = [];
  for (let index = body.length; index > 0; index -= 3) {
    groups.unshift(body.slice(Math.max(0, index - 3), index));
  }

  return `${groups.join(".")}-${verifier}`;
}

export function isValidChileanRut(value: string | null | undefined): boolean {
  const normalized = normalizeChileanRut(value);
  if (!RUT_PATTERN.test(normalized)) {
    return false;
  }

  const body = normalized.slice(0, -1);
  const verifier = normalized.slice(-1);
  if (body.length < 7) {
    return false;
  }

  return verifier === calculateVerifier(body);
}

export function chileanRutValidator(countryControlName = "country"): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? "").trim();
    const parent = control.parent;
    const countryControl = parent?.get(countryControlName);
    const country = String(countryControl?.value ?? "CL").toUpperCase();
    if (country !== "CL" || !value) {
      return null;
    }

    return isValidChileanRut(value) ? null : { chileanRut: true };
  };
}

function calculateVerifier(body: string): string {
  let multiplier = 2;
  let sum = 0;

  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const result = 11 - (sum % 11);
  if (result === 11) {
    return "0";
  }
  if (result === 10) {
    return "K";
  }
  return String(result);
}
