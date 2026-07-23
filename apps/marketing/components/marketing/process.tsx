import { process } from "@/content/process";

export function Process() {
  return (
    <section id="proceso" className="bg-white py-24">
      <div className="container-kaklen">
        <div className="max-w-2xl">
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-blue-600">Cómo trabajamos</p>
          <h2 className="text-balance mt-3 font-display text-[32px] font-bold leading-tight text-navy-950 sm:text-[38px]">
            Un proceso simple, pensado para reducir riesgo en cada etapa.
          </h2>
        </div>

        <ol className="mt-16 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
          {process.map((item, index) => (
            <li key={item.id} className="relative">
              <div className="flex items-center gap-3 lg:block">
                <span className="font-display text-[28px] font-extrabold text-blue-500/25">{item.step}</span>
                {index < process.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="hidden h-px flex-1 bg-gradient-to-r from-navy-800/15 to-transparent lg:mt-4 lg:block"
                  />
                ) : null}
              </div>
              <h3 className="mt-3 font-display text-[16px] font-bold text-navy-950">{item.title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-gray-600">{item.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
