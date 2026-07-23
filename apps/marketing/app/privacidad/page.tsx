import type { Metadata } from "next";
import { LegalLayout } from "@/components/marketing/legal-layout";

export const metadata: Metadata = { title: "Política de privacidad" };

export default function PrivacidadPage() {
  return (
    <LegalLayout title="Política de privacidad" updated="22 de julio de 2026">
      <section>
        <h2>1. Qué información recopilamos</h2>
        <p>
          Cuando completas el formulario de contacto de este sitio recopilamos: nombre, apellido, correo
          electrónico, país y número de teléfono, empresa y cargo (opcionales), país de interés, el tipo de
          solicitud y el mensaje que escribes. También registramos la fecha y el texto exacto de los
          consentimientos que aceptas, y datos técnicos limitados (origen de la visita, página de destino y
          un identificador no reversible derivado de tu dirección IP) con fines de seguridad y prevención de
          abuso.
        </p>
      </section>

      <section>
        <h2>2. Para qué usamos tu información</h2>
        <ul>
          <li>Responder a tu solicitud de asesoría o contacto.</li>
          <li>Contactarte por correo electrónico y, solo si lo autorizas explícitamente, por WhatsApp.</li>
          <li>Prevenir spam, abuso y uso indebido del formulario.</li>
          <li>Mejorar el contenido y funcionamiento de este sitio.</li>
        </ul>
      </section>

      <section>
        <h2>3. Base legal</h2>
        <p>
          Tratamos tu información con base en el consentimiento que otorgas expresamente al enviar el
          formulario. Puedes retirar tu consentimiento en cualquier momento escribiéndonos a través de los
          canales de contacto indicados en el sitio.
        </p>
      </section>

      <section>
        <h2>4. Contacto por WhatsApp</h2>
        <p>
          Solo te contactaremos por WhatsApp si marcas explícitamente la casilla de autorización en el
          formulario. Ese consentimiento es independiente de la aceptación de esta política y puede
          otorgarse o no sin afectar el resto de tu solicitud. Cuando la integración de proveedor está
          habilitada, el envío se realiza mediante una API empresarial autorizada; en modo manual, nuestro
          equipo realiza el contacto sin automatizaciones no autorizadas.
        </p>
      </section>

      <section>
        <h2>5. Con quién compartimos tu información</h2>
        <p>
          No vendemos tu información. Podemos compartirla con proveedores estrictamente necesarios para
          operar el servicio (por ejemplo, el proveedor de mensajería de WhatsApp Business y el proveedor de
          correo transaccional), quienes solo procesan los datos en nuestro nombre.
        </p>
      </section>

      <section>
        <h2>6. Retención y eliminación</h2>
        <p>
          Conservamos tu información mientras exista una relación comercial activa o potencial, o mientras
          sea necesario para los fines descritos. Puedes solicitar la eliminación de tus datos en cualquier
          momento; procesaremos esa solicitud salvo que exista una obligación legal de conservarlos.
        </p>
      </section>

      <section>
        <h2>7. Tus derechos</h2>
        <p>
          Puedes solicitar acceso, rectificación o eliminación de tu información, y oponerte a su
          tratamiento, escribiéndonos a través de los canales de contacto de este sitio.
        </p>
      </section>

      <section>
        <h2>8. Contacto</h2>
        <p>Para cualquier consulta sobre esta política, puedes escribirnos a través del formulario de contacto o de @kaklen.cl.</p>
      </section>
    </LegalLayout>
  );
}
