"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { contactFormSchema, contactFormDefaults, type ContactFormValues } from "@/lib/validation";
import { submitLead } from "@/lib/api-client";
import { interestOptions } from "@/content/interests";
import { COUNTRIES } from "@/content/countries";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

type Status = "idle" | "submitting" | "success" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [whatsappScheduled, setWhatsappScheduled] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: contactFormDefaults
  });

  const whatsappConsent = watch("whatsappConsent");

  async function onSubmit(values: ContactFormValues) {
    setStatus("submitting");
    setServerMessage(null);

    const params = new URLSearchParams(window.location.search);
    const result = await submitLead(values, {
      landingPage: window.location.pathname,
      referrer: document.referrer || undefined,
      utmSource: params.get("utm_source") ?? undefined,
      utmMedium: params.get("utm_medium") ?? undefined,
      utmCampaign: params.get("utm_campaign") ?? undefined,
      utmContent: params.get("utm_content") ?? undefined
    });

    if (result.success) {
      setStatus("success");
      setWhatsappScheduled(result.whatsapp.scheduled);
    } else {
      setStatus("error");
      setServerMessage(result.message);
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-3xl border border-navy-800/10 bg-white p-10 text-center sm:p-14" role="status">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10 text-blue-600">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 12.5 9.5 18 20 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="mt-6 font-display text-[22px] font-bold text-navy-950">Gracias por dar el primer paso.</h3>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-gray-600">
          Hemos recibido tu solicitud. Nuestro equipo la revisará y se pondrá en contacto contigo.
          {whatsappScheduled
            ? " También enviamos un mensaje de bienvenida a tu WhatsApp."
            : ""}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <a href="#top" className="link-underline text-[14px] font-medium text-blue-600">
            Volver al inicio
          </a>
          <a href="#soluciones" className="link-underline text-[14px] font-medium text-blue-600">
            Explorar soluciones
          </a>
          <a
            href={process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? "https://instagram.com/kaklen.cl"}
            target="_blank"
            rel="noreferrer noopener"
            className="link-underline text-[14px] font-medium text-blue-600"
          >
            Visitar @kaklen.cl
          </a>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-busy={status === "submitting"}
      className="rounded-3xl border border-navy-800/10 bg-white p-7 sm:p-10"
    >
      {/* Honeypot: campo invisible para personas, visible para bots de envío automático. */}
      <div className="absolute left-[-9999px]" aria-hidden="true">
        <label htmlFor="website">No completar este campo</label>
        <input id="website" type="text" tabIndex={-1} autoComplete="off" {...register("website")} />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Nombre" htmlFor="firstName" required error={errors.firstName?.message}>
          <Input id="firstName" autoComplete="given-name" aria-required="true" aria-invalid={!!errors.firstName} aria-describedby={errors.firstName ? "firstName-error" : undefined} {...register("firstName")} />
        </Field>
        <Field label="Apellido" htmlFor="lastName" required error={errors.lastName?.message}>
          <Input id="lastName" autoComplete="family-name" aria-required="true" aria-invalid={!!errors.lastName} aria-describedby={errors.lastName ? "lastName-error" : undefined} {...register("lastName")} />
        </Field>

        <Field label="Correo electrónico" htmlFor="email" required error={errors.email?.message} className="sm:col-span-2">
          <Input id="email" type="email" autoComplete="email" aria-required="true" aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} {...register("email")} />
        </Field>

        <Field label="País (teléfono)" htmlFor="countryCode" required error={errors.countryCode?.message}>
          <Select id="countryCode" aria-required="true" aria-invalid={!!errors.countryCode} aria-describedby={errors.countryCode ? "countryCode-error" : undefined} {...register("countryCode")}>
            {COUNTRIES.map((country) => (
              <option key={country.code} value={country.code}>
                {country.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Teléfono con WhatsApp" htmlFor="phone" required error={errors.phone?.message}>
          <Input id="phone" type="tel" autoComplete="tel-national" placeholder="9 1234 5678" aria-required="true" aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "phone-error" : undefined} {...register("phone")} />
        </Field>

        <Field label="Empresa" htmlFor="company" error={errors.company?.message}>
          <Input id="company" autoComplete="organization" aria-invalid={!!errors.company} aria-describedby={errors.company ? "company-error" : undefined} {...register("company")} />
        </Field>
        <Field label="Cargo o función" htmlFor="position" error={errors.position?.message}>
          <Input id="position" autoComplete="organization-title" aria-invalid={!!errors.position} aria-describedby={errors.position ? "position-error" : undefined} {...register("position")} />
        </Field>

        <Field label="País" htmlFor="country" error={errors.country?.message}>
          <Select id="country" defaultValue="" aria-invalid={!!errors.country} aria-describedby={errors.country ? "country-error" : undefined} {...register("country")}>
            <option value="">Selecciona un país</option>
            {COUNTRIES.map((country) => (
              <option key={country.code} value={country.label}>
                {country.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tipo de interés" htmlFor="interestType" required error={errors.interestType?.message}>
          <Select id="interestType" defaultValue="" aria-required="true" aria-invalid={!!errors.interestType} aria-describedby={errors.interestType ? "interestType-error" : undefined} {...register("interestType")}>
            <option value="" disabled>
              Selecciona una opción
            </option>
            {interestOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Mensaje" htmlFor="message" required error={errors.message?.message} className="sm:col-span-2">
          <Textarea
            id="message"
            placeholder="Cuéntanos brevemente sobre tu proyecto u oportunidad."
            aria-required="true"
            aria-invalid={!!errors.message}
            aria-describedby={errors.message ? "message-error" : undefined}
            {...register("message")}
          />
        </Field>
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t border-navy-800/10 pt-6">
        <Checkbox
          id="privacyConsent"
          aria-required="true"
          aria-invalid={!!errors.privacyConsent}
          aria-describedby={errors.privacyConsent ? "privacyConsent-error" : undefined}
          label={
            <>
              He leído y acepto la{" "}
              <a href="/privacidad" className="font-medium text-blue-600 underline underline-offset-2">
                Política de Privacidad
              </a>
              .
            </>
          }
          {...register("privacyConsent")}
        />
        {errors.privacyConsent ? (
          <p id="privacyConsent-error" role="alert" className="text-[12.5px] font-medium text-red-600">
            {errors.privacyConsent.message}
          </p>
        ) : null}

        <Checkbox
          id="whatsappConsent"
          label="Autorizo a Kaklen a contactarme por WhatsApp sobre mi solicitud."
          checked={whatsappConsent}
          {...register("whatsappConsent")}
        />
      </div>

      <div aria-live="polite" className="sr-only">
        {status === "submitting" ? "Enviando solicitud" : ""}
        {status === "error" ? `Error: ${serverMessage}` : ""}
      </div>

      {status === "error" ? (
        <p role="alert" className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-[13.5px] font-medium text-red-700">
          {serverMessage ?? "Revisa los campos indicados."}
        </p>
      ) : null}

      <Button type="submit" disabled={status === "submitting"} className="mt-8 w-full sm:w-auto">
        {status === "submitting" ? "Enviando…" : "Solicitar asesoría"}
      </Button>
    </form>
  );
}
