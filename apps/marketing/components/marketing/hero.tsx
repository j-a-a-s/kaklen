import { ButtonLink } from "@/components/ui/button";

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-navy-950 pt-20 pb-28 md:pt-28 md:pb-36">
      <HeroMesh />

      <div className="container-kaklen relative">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Inversiones &amp; Tecnología
          </span>

          <h1 className="text-balance mt-7 font-display text-[40px] font-extrabold leading-[1.08] text-white sm:text-[52px] lg:text-[64px]">
            Invertimos hoy.
            <br />
            Construimos el{" "}
            <span className="bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
              mañana
            </span>
            .
          </h1>

          <p className="text-balance mt-6 max-w-xl text-[18px] leading-relaxed text-white/75">
            Transformamos ideas en tecnología, tecnología en oportunidades y oportunidades en crecimiento.
          </p>

          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/50">
            Kaklen impulsa soluciones digitales, plataformas empresariales e innovación con visión
            estratégica y propósito.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <ButtonLink href="#contacto" variant="primary">
              Solicitar asesoría
            </ButtonLink>
            <ButtonLink href="#manifiesto" variant="ghost">
              Descubrir Kaklen
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroMesh() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="animate-drift absolute -right-24 -top-24 h-[620px] w-[620px] opacity-[0.35]">
        <svg viewBox="0 0 600 600" className="h-full w-full">
          <defs>
            <linearGradient id="mesh-line" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#144fa8" stopOpacity="0" />
              <stop offset="55%" stopColor="#2f8fff" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#52b9ff" stopOpacity="0" />
            </linearGradient>
          </defs>
          {Array.from({ length: 7 }).map((_, i) => (
            <line
              key={i}
              x1={i * 90}
              y1="600"
              x2={i * 90 + 260}
              y2="0"
              stroke="url(#mesh-line)"
              strokeWidth="1"
            />
          ))}
          <circle cx="420" cy="140" r="3" fill="#52b9ff" />
          <circle cx="240" cy="330" r="2.5" fill="#2f8fff" />
          <circle cx="480" cy="360" r="2" fill="#52b9ff" />
          <circle cx="150" cy="120" r="2" fill="#2f8fff" />
        </svg>
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-navy-950/20 to-navy-950" />
    </div>
  );
}
