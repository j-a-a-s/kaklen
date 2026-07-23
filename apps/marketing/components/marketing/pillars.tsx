import { pillars } from "@/content/pillars";

export function Pillars() {
  return (
    <section className="bg-white py-24">
      <div className="container-kaklen">
        <div className="max-w-2xl">
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-blue-600">Cómo pensamos</p>
          <h2 className="text-balance mt-3 font-display text-[32px] font-bold leading-tight text-navy-950 sm:text-[38px]">
            Construimos tecnología con visión de largo plazo.
          </h2>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-navy-800/10 bg-navy-800/10 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((pillar, index) => (
            <div key={pillar.id} className="flex flex-col gap-4 bg-white p-8">
              <span className="font-display text-[13px] font-bold text-blue-500">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="font-display text-[17px] font-bold text-navy-950">{pillar.title}</h3>
              <p className="text-[14.5px] leading-relaxed text-gray-600">{pillar.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
