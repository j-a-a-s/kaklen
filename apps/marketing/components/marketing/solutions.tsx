import { solutions } from "@/content/solutions";
import { SolutionIconGlyph } from "./solution-icon";

export function Solutions() {
  return (
    <section id="soluciones" className="bg-gray-50 py-24">
      <div className="container-kaklen">
        <div className="max-w-2xl">
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-blue-600">Soluciones</p>
          <h2 className="text-balance mt-3 font-display text-[32px] font-bold leading-tight text-navy-950 sm:text-[38px]">
            Un equipo, todas las capacidades para llevar una idea a producción.
          </h2>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {solutions.map((solution) => (
            <article
              key={solution.id}
              className="group rounded-2xl border border-navy-800/10 bg-white p-7 transition-all hover:-translate-y-0.5 hover:border-blue-500/30 hover:shadow-[0_20px_40px_-24px_rgba(20,79,168,0.35)]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                <SolutionIconGlyph icon={solution.icon} className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-display text-[16px] font-bold text-navy-950">{solution.name}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-gray-600">{solution.description}</p>
              <p className="mt-4 text-[13px] font-medium text-blue-600">{solution.benefit}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
