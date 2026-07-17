import { AbstractControl, ValidationErrors } from "@angular/forms";
import { currencyFractionDigits } from "@kaklen/shared";

export type ValidationFieldType =
  | "quantity"
  | "money"
  | "unitPrice"
  | "percentageDiscount"
  | "fixedDiscount"
  | "taxPercent"
  | "rut"
  | "phone"
  | "whatsapp"
  | "validUntil"
  | "password";

export interface ValidationMessageContext {
  readonly path: string;
  readonly label: string;
  readonly errors: ValidationErrors | null;
  readonly control: AbstractControl<unknown> | null;
  readonly currency?: string;
  readonly fieldType?: ValidationFieldType;
  readonly requiredMessage?: string;
  readonly fallbackMessage?: string;
}

const FIELD_LABELS: Readonly<Record<string, string>> = {
  name: $localize`:@@nameLabel:Nombre`,
  title: $localize`:@@titleLabel:Título`,
  quantity: $localize`:@@quantityLabel:Cantidad`,
  unit: $localize`:@@unitLabel:Unidad`,
  unitPrice: $localize`:@@unitPriceLabel:Precio unitario`,
  discountType: $localize`:@@discountTypeLabel:Tipo de descuento`,
  discountValue: $localize`:@@discountValueLabel:Descuento`,
  taxPercent: $localize`:@@taxPercentLabel:Impuesto %`,
  email: $localize`:@@emailLabel:Email`,
  externalEmail: $localize`:@@emailLabel:Email`,
  externalName: $localize`:@@nameLabel:Nombre`,
  role: $localize`:@@roleLabel:Rol`,
  code: $localize`:@@codeLabel:Código`,
  type: $localize`:@@typeLabel:Tipo`,
  price: $localize`:@@priceLabel:Precio`,
  cost: $localize`:@@costLabel:Costo`,
  budget: $localize`:@@budgetLabel:Presupuesto`,
  whatsapp: $localize`:@@whatsappLabel:WhatsApp`,
  taxId: $localize`:@@taxIdLabel:RUT o identificación tributaria`,
  validUntil: $localize`:@@validUntilLabel:Válida hasta`
};

const COLLECTION_LABELS: Readonly<Record<string, string>> = {
  items: $localize`:@@validationCollectionItem:Ítem`,
  participants: $localize`:@@validationCollectionParticipant:Participante`,
  tasks: $localize`:@@validationCollectionTask:Tarea`,
  resources: $localize`:@@validationCollectionResource:Recurso`
};

export class ValidationMessageResolver {
  resolve(context: ValidationMessageContext): string {
    const errors = context.errors;
    if (!errors) return "";
    if (errors["required"]) {
      return context.requiredMessage ?? $localize`:@@fieldRequiredError:Este campo es obligatorio.`;
    }
    if (errors["whitespace"]) {
      return $localize`:@@fieldWhitespaceError:Ingresa un valor válido; no puede contener solo espacios.`;
    }

    const fieldType = context.fieldType ?? inferFieldType(context.path, context.label, context.control);
    const businessMessage = this.businessMessage(fieldType, context.currency, errors);
    if (businessMessage) return businessMessage;

    if (errors["email"]) {
      return $localize`:@@emailValidation:Ingresa un correo válido, por ejemplo nombre@empresa.cl.`;
    }
    if (errors["phone"]) {
      return $localize`:@@phoneValidation:Ingresa un teléfono válido con código de país, por ejemplo +56 9 1234 5678.`;
    }
    if (errors["chileanRut"]) return $localize`:@@rutValidation:Ingresa un RUT válido.`;
    if (errors["decimal"]) return $localize`:@@decimalValidation:Ingresa un número válido.`;
    if (errors["precision"]) {
      const maximum = numericErrorProperty(errors["precision"], "maxDecimalPlaces");
      return $localize`:@@precisionValidation:Este campo admite como máximo ${maximum}:maximum: decimales.`;
    }
    if (errors["min"]) {
      const minimum = numericErrorProperty(errors["min"], "min");
      return $localize`:@@minValidation:El valor mínimo permitido es ${minimum}:minimum:.`;
    }
    if (errors["max"]) {
      const maximum = numericErrorProperty(errors["max"], "max");
      return $localize`:@@maxValidation:El valor máximo permitido es ${maximum}:maximum:.`;
    }
    if (errors["maxlength"]) {
      const maximum = numericErrorProperty(errors["maxlength"], "requiredLength");
      return $localize`:@@maxLengthValidation:Puedes ingresar como máximo ${maximum}:maximum: caracteres.`;
    }
    if (errors["minlength"]) {
      const minimum = numericErrorProperty(errors["minlength"], "requiredLength");
      return $localize`:@@minLengthValidation:Debes ingresar al menos ${minimum}:minimum: caracteres.`;
    }
    if (errors["dateOrder"]) {
      return $localize`:@@dateOrderValidation:La fecha de término debe ser igual o posterior a la fecha de inicio.`;
    }
    if (errors["mismatch"]) return $localize`:@@mismatchValidation:Los valores ingresados no coinciden.`;
    if (errors["pattern"]) {
      return context.fallbackMessage ?? $localize`:@@patternValidation:Ingresa un valor con el formato solicitado.`;
    }
    if (errors["atLeastOne"]) {
      return $localize`:@@atLeastOneValidation:Completa al menos uno de los campos indicados.`;
    }
    return context.fallbackMessage ?? $localize`:@@fieldInvalidKnownError:El valor ingresado no cumple la regla del campo.`;
  }

  private businessMessage(
    fieldType: ValidationFieldType | undefined,
    currency: string | undefined,
    errors: ValidationErrors
  ): string {
    if (!hasRuleError(errors)) return "";
    if (fieldType === "quantity") {
      return $localize`:@@quantityValidation:La cantidad debe ser mayor que 0 y admitir como máximo 3 decimales.`;
    }
    if (fieldType === "unitPrice" || fieldType === "money") {
      return usesWholeCurrencyUnits(currency)
        ? $localize`:@@clpMoneyValidation:Ingresa un monto en pesos chilenos sin decimales.`
        : $localize`:@@moneyValidation:Ingresa un monto mayor o igual a 0 con máximo 2 decimales.`;
    }
    if (fieldType === "percentageDiscount") {
      return $localize`:@@percentageDiscountValidation:El descuento debe estar entre 0 % y 100 %.`;
    }
    if (fieldType === "fixedDiscount") {
      return usesWholeCurrencyUnits(currency)
        ? $localize`:@@clpFixedDiscountValidation:Ingresa un descuento en pesos chilenos sin decimales y no superior al subtotal de la línea.`
        : $localize`:@@fixedDiscountValidation:Ingresa un descuento no superior al subtotal de la línea y con máximo 2 decimales.`;
    }
    if (fieldType === "taxPercent") {
      return $localize`:@@taxValidation:El impuesto debe estar entre 0 % y 100 %.`;
    }
    if (fieldType === "rut") {
      return $localize`:@@rutExampleValidation:Ingresa un RUT válido, por ejemplo 12.345.678-5.`;
    }
    if (fieldType === "whatsapp") {
      return $localize`:@@whatsappValidation:Ingresa un número de WhatsApp válido con código de país, por ejemplo +56 9 1234 5678.`;
    }
    if (fieldType === "validUntil") {
      return $localize`:@@validUntilValidation:La fecha de vigencia debe ser igual o posterior a la fecha de emisión.`;
    }
    return "";
  }
}

export const validationMessageResolver = new ValidationMessageResolver();

export function resolveValidationLabel(path: string, labels: Readonly<Record<string, string>> = {}): string {
  const exact = labels[path];
  if (exact) return exact;
  const parts = path.split(".");
  const field = parts.at(-1) ?? path;
  const fieldLabel = labels[field] ?? FIELD_LABELS[field] ?? humanize(field);
  if (parts.length >= 3 && /^\d+$/.test(parts.at(-2) ?? "")) {
    const collection = parts.at(-3) ?? "";
    const collectionLabel = COLLECTION_LABELS[collection];
    if (collectionLabel) {
      const index = Number(parts.at(-2)) + 1;
      return $localize`:@@nestedValidationLabel:${collectionLabel}:collection: ${index}:index:: ${fieldLabel}:field:`;
    }
  }
  return fieldLabel;
}

function inferFieldType(
  path: string,
  label: string,
  control: AbstractControl<unknown> | null
): ValidationFieldType | undefined {
  const field = path.split(".").at(-1) ?? "";
  if (field === "quantity" || field === "resourceQuantity") return "quantity";
  if (field === "unitPrice") return "unitPrice";
  if (["price", "cost", "budget", "amount", "unitCost"].includes(field)) return "money";
  if (field === "taxPercent") return "taxPercent";
  if (field === "globalDiscountPercent") return "percentageDiscount";
  if (field === "discountValue") {
    return control?.parent?.get("discountType")?.value === "PERCENTAGE" ? "percentageDiscount" : "fixedDiscount";
  }
  if (field === "taxId" || /RUT/i.test(label)) return "rut";
  if (field === "whatsapp") return "whatsapp";
  if (field === "phone" || field === "contactPhone") return "phone";
  if (field === "validUntil") return "validUntil";
  if (field.toLowerCase().includes("password")) return "password";
  return undefined;
}

function hasRuleError(errors: ValidationErrors): boolean {
  return ["decimal", "precision", "min", "max", "pattern", "chileanRut", "phone", "dateOrder"].some(
    (name) => Boolean(errors[name])
  );
}

function numericErrorProperty(value: unknown, property: string): number | string {
  if (typeof value !== "object" || value === null) return "";
  const propertyValue = (value as Record<string, unknown>)[property];
  return typeof propertyValue === "number" || typeof propertyValue === "string" ? propertyValue : "";
}

function humanize(value: string): string {
  const spaced = value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").trim();
  return spaced ? `${spaced.charAt(0).toUpperCase()}${spaced.slice(1).toLowerCase()}` : $localize`:@@fieldLabelFallback:Campo`;
}

function usesWholeCurrencyUnits(currency: string | undefined): boolean {
  return Boolean(currency && currencyFractionDigits(currency) === 0);
}
