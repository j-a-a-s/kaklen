import { z } from "zod";
import { LEAD_INTERESTS } from "@/content/interests";

const personNamePattern = /^[\p{L}\p{M}][\p{L}\p{M}' -]*$/u;
const safeSingleLinePattern = /^[^\u0000-\u001f\u007f<>]*$/u;
const safeMultilinePattern = /^[^\u0000-\u0008\u000b-\u001f\u007f]*$/u;
const phonePattern = /^[0-9()+. -]+$/u;

export const contactFormSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, "Ingresa tu nombre.")
    .max(80)
    .regex(personNamePattern, "Ingresa un nombre válido."),
  lastName: z
    .string()
    .trim()
    .min(2, "Ingresa tu apellido.")
    .max(80)
    .regex(personNamePattern, "Ingresa un apellido válido."),
  email: z.string().trim().email("Ingresa un correo válido."),
  countryCode: z.string().length(2, "Selecciona un país."),
  phone: z
    .string()
    .trim()
    .min(6, "Ingresa un teléfono válido.")
    .max(40)
    .regex(phonePattern, "Ingresa un teléfono válido."),
  company: z
    .string()
    .trim()
    .max(160)
    .regex(safeSingleLinePattern, "Ingresa una empresa válida.")
    .optional()
    .or(z.literal("")),
  position: z
    .string()
    .trim()
    .max(160)
    .regex(safeSingleLinePattern, "Ingresa un cargo válido.")
    .optional()
    .or(z.literal("")),
  country: z
    .string()
    .trim()
    .max(160)
    .regex(safeSingleLinePattern, "Ingresa un país válido.")
    .optional()
    .or(z.literal("")),
  interestType: z.enum(LEAD_INTERESTS, {
    errorMap: () => ({ message: "Selecciona una opción." })
  }),
  message: z
    .string()
    .trim()
    .min(10, "Cuéntanos un poco más (mínimo 10 caracteres).")
    .max(2000)
    .regex(safeMultilinePattern, "El mensaje contiene caracteres no permitidos."),
  privacyConsent: z.literal(true, {
    errorMap: () => ({ message: "Debes aceptar la política de privacidad." })
  }),
  whatsappConsent: z.boolean(),
  website: z.string().max(0).optional()
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;

export const contactFormDefaults: Partial<ContactFormValues> = {
  countryCode: "CL",
  whatsappConsent: false,
  website: ""
};
