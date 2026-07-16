import { registerDecorator, ValidationArguments, ValidationOptions } from "class-validator";
import {
  formatChileanRut as formatSharedChileanRut,
  isValidChileanRut as isValidSharedChileanRut,
  normalizeChileanRut as normalizeSharedChileanRut
} from "@kaklen/shared/chilean-rut";

export const normalizeChileanRut = normalizeSharedChileanRut;
export const isValidChileanRut = isValidSharedChileanRut;
export const formatChileanRut = formatSharedChileanRut;

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
