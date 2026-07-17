import { AbstractControl, ValidationErrors, ValidatorFn } from "@angular/forms";
import {
  VALIDATION_LIMITS,
  countryBusinessPolicy,
  currencyFractionDigits,
  moneyToMinorUnits,
  normalizeInternationalPhone
} from "@kaklen/shared";

export const FIELD_LIMITS = VALIDATION_LIMITS;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_VISUAL_PATTERN = /^\+?[0-9][0-9\s()-]*$/;

export function trimmedRequired(): ValidatorFn {
  return (control: AbstractControl<unknown>): ValidationErrors | null => {
    return typeof control.value === "string" && control.value.trim().length === 0 ? { whitespace: true } : null;
  };
}

export function emailValidator(required = false): ValidatorFn {
  return (control: AbstractControl<unknown>): ValidationErrors | null => {
    const value = typeof control.value === "string" ? control.value.trim() : "";
    if (!value) return required ? { required: true } : null;
    if (value.length > FIELD_LIMITS.email) return { maxlength: { requiredLength: FIELD_LIMITS.email, actualLength: value.length } };
    return EMAIL_PATTERN.test(value) ? null : { email: true };
  };
}

export interface PhoneValidatorOptions {
  required?: boolean;
  country?: () => string;
  requireCountryCode?: boolean;
}

export function internationalPhoneValidator(options: PhoneValidatorOptions = {}): ValidatorFn {
  return (control: AbstractControl<unknown>): ValidationErrors | null => {
    const value = typeof control.value === "string" ? control.value.trim() : "";
    if (!value) return options.required ? { required: true } : null;
    if (!PHONE_VISUAL_PATTERN.test(value)) return { phone: true };
    const country = options.country?.().toUpperCase() ?? "CL";
    if (options.requireCountryCode) {
      return countryBusinessPolicy(country).phonePattern.test(normalizeInternationalPhone(value))
        ? null
        : { phone: true };
    }
    const digits = value.replace(/\D/g, "");
    const normalized = value.startsWith("+")
      ? normalizeInternationalPhone(value)
      : country === "CL" && digits.length === 9
        ? `+56${digits}`
        : "";
    return countryBusinessPolicy(country).phonePattern.test(normalized) ? null : { phone: true };
  };
}

export function decimalValidator(
  minimum: number,
  maximum: number,
  maxDecimalPlaces: number,
  required = true
): ValidatorFn {
  return (control: AbstractControl<unknown>): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === "") return required ? { required: true } : null;
    const source = String(value).trim().replace(",", ".");
    if (!/^[-+]?\d+(?:\.\d+)?$/.test(source)) return { decimal: true };
    const decimalPlaces = source.split(".")[1]?.length ?? 0;
    if (decimalPlaces > maxDecimalPlaces) return { precision: { maxDecimalPlaces } };
    const parsed = Number(source);
    if (!Number.isFinite(parsed)) return { decimal: true };
    if (parsed < minimum) return { min: { min: minimum, actual: parsed } };
    if (parsed > maximum) return { max: { max: maximum, actual: parsed } };
    return null;
  };
}

export function moneyValidator(
  currency: () => string,
  maximum?: () => string,
  required = true
): ValidatorFn {
  return (control: AbstractControl<unknown>): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === "") return required ? { required: true } : null;
    const source = String(value).trim().replace(",", ".");
    if (!/^[-+]?\d+(?:\.\d+)?$/.test(source)) return { decimal: true };
    const normalizedCurrency = currency().toUpperCase();
    const maxDecimalPlaces = currencyFractionDigits(normalizedCurrency);
    const fraction = source.split(".")[1] ?? "";
    if (fraction.length > maxDecimalPlaces) {
      return { precision: { maxDecimalPlaces, currency: normalizedCurrency } };
    }
    const minorUnits = BigInt(moneyToMinorUnits(source, normalizedCurrency));
    if (minorUnits < 0n) return { min: { min: 0, actual: source } };
    const maximumValue = maximum?.();
    if (maximumValue !== undefined && minorUnits > BigInt(moneyToMinorUnits(maximumValue, normalizedCurrency))) {
      return { max: { max: maximumValue, actual: source } };
    }
    return null;
  };
}

export function dateOrderValidator(startControlName: string, endControlName: string, allowEqual = true): ValidatorFn {
  return (control: AbstractControl<unknown>): ValidationErrors | null => {
    const start = control.get(startControlName)?.value;
    const end = control.get(endControlName)?.value;
    if (typeof start !== "string" || typeof end !== "string" || !start || !end) return null;
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const ordered = allowEqual ? endTime >= startTime : endTime > startTime;
    return Number.isFinite(startTime) && Number.isFinite(endTime) && ordered ? null : { dateOrder: true };
  };
}

export function atLeastOneValidator(controlNames: readonly string[]): ValidatorFn {
  return (control: AbstractControl<unknown>): ValidationErrors | null => {
    const hasValue = controlNames.some((name) => {
      const value = control.get(name)?.value;
      return typeof value === "string" ? value.trim().length > 0 : value !== null && value !== undefined;
    });
    return hasValue ? null : { atLeastOne: { controls: controlNames } };
  };
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizePhone(value: string): string {
  return normalizeInternationalPhone(value);
}
