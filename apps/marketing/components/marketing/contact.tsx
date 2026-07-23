import { ContactForm } from "./contact-form";

export function Contact() {
  return (
    <section id="contacto" className="bg-gray-50 py-24">
      <div className="container-kaklen grid grid-cols-1 gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div className="lg:sticky lg:top-28">
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-blue-600">Conversemos</p>
          <h2 className="text-balance mt-3 font-display text-[32px] font-bold leading-tight text-navy-950 sm:text-[38px]">
            Conversemos sobre tu próxima oportunidad.
          </h2>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-gray-600">
            Cuéntanos sobre tu proyecto, idea o desafío. Un miembro del equipo Kaklen revisará tu
            solicitud y se pondrá en contacto contigo.
          </p>

          <dl className="mt-10 flex flex-col gap-5 text-[14px]">
            <div>
              <dt className="font-semibold text-navy-950">Instagram</dt>
              <dd className="mt-1 text-gray-600">@kaklen.cl</dd>
            </div>
            <div>
              <dt className="font-semibold text-navy-950">Tiempo de respuesta</dt>
              <dd className="mt-1 text-gray-600">Normalmente en menos de 2 días hábiles.</dd>
            </div>
          </dl>
        </div>

        <div className="relative">
          <ContactForm />
        </div>
      </div>
    </section>
  );
}
