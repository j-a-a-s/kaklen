import { registerDecorator, ValidationArguments, ValidationOptions } from "class-validator";

const RUT_PATTERN = /^\d{1,8}[0-9K]$/;

export function normalizeChileanRut(value: string | null | undefined): string {
  return (value ?? "").replace(/[.\-\s]/g, "").toUpperCase();
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

export function IsChileanRutWhen(
  predicate: (object: unknown) => boolean,
  validationOptions?: ValidationOptions
): PropertyDecorator {
  return (object, propertyName) => {
    registerDecorator({
      name: "isChileanRutWhen",
      target: object.constructor,
      propertyName: String(propertyName),
      constraints: [predicate],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const shouldValidate = (args.constraints[0] as (object: unknown) => boolean)(args.object);
          if (!shouldValidate || value === undefined || value === null || value === "") {
            return true;
          }
          return typeof value === "string" && isValidChileanRut(value);
        }
      }
    });
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
