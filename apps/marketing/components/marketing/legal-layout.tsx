import type { ReactNode } from "react";

export function LegalLayout({
  title,
  updated,
  children
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <article className="bg-white py-20">
      <div className="container-kaklen max-w-[720px]">
        <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-blue-600">Legal</p>
        <h1 className="mt-3 font-display text-[32px] font-bold text-navy-950 sm:text-[38px]">{title}</h1>
        <p className="mt-2 text-[13.5px] text-gray-500">Última actualización: {updated}</p>

        <div className="mt-6 rounded-xl border border-amber-300/60 bg-amber-50 px-5 py-4 text-[13.5px] leading-relaxed text-amber-900">
          Este texto es un borrador de referencia y todavía no ha sido revisado por un equipo legal. No debe
          considerarse asesoría legal ni garantía de cumplimiento normativo hasta su revisión y aprobación
          formal.
        </div>

        <div className="prose-legal mt-10 flex flex-col gap-8 text-[15px] leading-relaxed text-gray-700 [&_h2]:font-display [&_h2]:text-[19px] [&_h2]:font-bold [&_h2]:text-navy-950 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1.5">
          {children}
        </div>
      </div>
    </article>
  );
}
