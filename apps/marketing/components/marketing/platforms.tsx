import { platforms, platformStatusLabel } from "@/content/platforms";

export function Platforms() {
  return (
    <section id="plataformas" className="bg-white py-24">
      <div className="container-kaklen">
        <div className="max-w-2xl">
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-blue-600">Ecosistema</p>
          <h2 className="text-balance mt-3 font-display text-[32px] font-bold leading-tight text-navy-950 sm:text-[38px]">
            Kaklen impulsa y desarrolla plataformas con visión de futuro.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-gray-600">
            Cada plataforma nace de una oportunidad real y se construye con la misma disciplina técnica que
            aplicamos en nuestros proyectos de consultoría.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {platforms.map((platform) => (
            <article
              key={platform.id}
              className="relative overflow-hidden rounded-3xl bg-navy-950 p-9 lg:col-span-2"
            >
              <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
              <span className="relative inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-400">
                {platformStatusLabel(platform.status)}
              </span>
              <h3 className="relative mt-5 font-display text-[26px] font-bold text-white">{platform.name}</h3>
              <p className="relative mt-1.5 font-display text-[15px] font-medium text-cyan-400">
                {platform.tagline}
              </p>
              <p className="relative mt-4 max-w-lg text-[14.5px] leading-relaxed text-white/70">
                {platform.description}
              </p>
            </article>
          ))}

          <div className="flex flex-col justify-center rounded-3xl border border-dashed border-navy-800/20 p-9 text-center lg:col-span-1">
            <p className="font-display text-[15px] font-semibold text-navy-950">Próxima plataforma</p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-gray-500">
              Seguimos evaluando nuevas oportunidades para el ecosistema Kaklen.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
