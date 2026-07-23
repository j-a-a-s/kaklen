import type { Metadata } from "next";
import { LegalLayout } from "@/components/marketing/legal-layout";

export const metadata: Metadata = { title: "Términos y condiciones" };

export default function TerminosPage() {
  return (
    <LegalLayout title="Términos y condiciones" updated="22 de julio de 2026">
      <section>
        <h2>1. Objeto</h2>
        <p>
          Este sitio presenta a Kaklen — Inversiones &amp; Tecnología, sus servicios y su ecosistema de
          plataformas, y permite solicitar contacto comercial a través de un formulario. El uso de este
          sitio implica la aceptación de estos términos.
        </p>
      </section>

      <section>
        <h2>2. Uso del sitio</h2>
        <p>
          Este sitio es de carácter informativo y comercial. No debe utilizarse para enviar contenido
          ilegal, fraudulento, ofensivo o que infrinja derechos de terceros. Kaklen puede rechazar o dejar
          sin efecto solicitudes que incumplan estos términos.
        </p>
      </section>

      <section>
        <h2>3. Propiedad intelectual</h2>
        <p>
          La marca Kaklen, su logotipo, los nombres de sus plataformas (incluyendo Kapiar) y el contenido de
          este sitio son propiedad de Kaklen o se usan con la autorización correspondiente. Ningún elemento
          de este sitio puede reproducirse sin autorización previa por escrito.
        </p>
      </section>

      <section>
        <h2>4. Naturaleza de la información</h2>
        <p>
          El contenido de este sitio tiene fines informativos generales y no constituye una oferta
          vinculante, asesoría de inversión, financiera ni legal. Cualquier propuesta comercial concreta se
          formalizará por separado.
        </p>
      </section>

      <section>
        <h2>5. Formulario de contacto</h2>
        <p>
          Al enviar el formulario de contacto declaras que la información proporcionada es veraz. El
          tratamiento de tus datos se rige por nuestra{" "}
          <a href="/privacidad" className="font-medium text-blue-600 underline underline-offset-2">
            Política de Privacidad
          </a>
          .
        </p>
      </section>

      <section>
        <h2>6. Enlaces a terceros</h2>
        <p>
          Este sitio enlaza a plataformas de terceros (por ejemplo, Instagram). Kaklen no controla ni se
          responsabiliza por el contenido o las políticas de esos sitios.
        </p>
      </section>

      <section>
        <h2>7. Modificaciones</h2>
        <p>
          Podemos actualizar estos términos en cualquier momento. La fecha de la última actualización se
          indica en la parte superior de esta página.
        </p>
      </section>

      <section>
        <h2>8. Contacto</h2>
        <p>Para consultas sobre estos términos, escríbenos a través del formulario de contacto o de @kaklen.cl.</p>
      </section>
    </LegalLayout>
  );
}
