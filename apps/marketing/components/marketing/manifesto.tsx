export function Manifesto() {
  return (
    <section id="manifiesto" className="relative overflow-hidden bg-navy-950 py-28">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        aria-hidden="true"
        style={{
          backgroundImage: "linear-gradient(135deg, transparent 48%, #2f8fff 49%, #2f8fff 51%, transparent 52%)",
          backgroundSize: "64px 64px"
        }}
      />

      <div className="container-kaklen relative max-w-3xl">
        <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-cyan-400">Nosotros</p>
        <h2 className="text-balance mt-5 font-display text-[30px] font-bold leading-[1.25] text-white sm:text-[38px]">
          Las mejores oportunidades no aparecen por casualidad. Se construyen.
        </h2>
        <p className="mt-8 text-[17px] leading-relaxed text-white/70">
          En Kaklen creemos que invertir significa mucho más que aportar capital. Significa apostar por el
          talento, la innovación y las ideas capaces de cambiar la forma en que vivimos y trabajamos. Las
          empresas del futuro no nacen por casualidad: nacen de una visión, de decisiones valientes y de
          tecnología construida con propósito.
        </p>
        <p className="mt-8 font-display text-[18px] font-semibold text-white">El futuro no espera. Se construye.</p>
      </div>
    </section>
  );
}
