import { KaklenLogo } from "@/components/brand/kaklen-logo";

const INSTAGRAM_URL = process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? "https://instagram.com/kaklen.cl";

const NAV_LINKS = [
  { href: "/#soluciones", label: "Soluciones" },
  { href: "/#plataformas", label: "Plataformas" },
  { href: "/#manifiesto", label: "Nosotros" },
  { href: "/#contacto", label: "Contacto" }
];

export function Footer() {
  return (
    <footer className="bg-navy-950 pt-20 pb-10">
      <div className="container-kaklen">
        <div className="grid grid-cols-1 gap-12 border-b border-white/10 pb-14 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <KaklenLogo tone="light" showTagline />
            <p className="mt-5 max-w-xs text-[14px] leading-relaxed text-white/55">
              Invertimos hoy, construimos el mañana.
            </p>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-6 inline-flex items-center gap-2 text-[13.5px] font-medium text-white/70 transition-colors hover:text-cyan-400"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="17.2" cy="6.8" r="1" fill="currentColor" />
              </svg>
              @kaklen.cl
            </a>
          </div>

          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/40">Navegación</p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="text-[14px] text-white/70 transition-colors hover:text-white">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/40">Legal</p>
            <ul className="mt-4 flex flex-col gap-2.5">
              <li>
                <a href="/privacidad" className="text-[14px] text-white/70 transition-colors hover:text-white">
                  Política de privacidad
                </a>
              </li>
              <li>
                <a href="/terminos" className="text-[14px] text-white/70 transition-colors hover:text-white">
                  Términos y condiciones
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-8 text-[13px] text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Kaklen — Inversiones &amp; Tecnología. Todos los derechos reservados.</p>
          <p>Santiago, Chile</p>
        </div>
      </div>
    </footer>
  );
}
