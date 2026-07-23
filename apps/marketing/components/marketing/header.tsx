"use client";

import { useState } from "react";
import { KaklenLogo } from "@/components/brand/kaklen-logo";
import { ButtonLink } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/#soluciones", label: "Soluciones" },
  { href: "/#plataformas", label: "Plataformas" },
  { href: "/#manifiesto", label: "Nosotros" },
  { href: "/#proceso", label: "Cómo trabajamos" }
];

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-navy-950/85 backdrop-blur-md">
      <div className="container-kaklen flex h-[72px] items-center justify-between">
        <a href="/" className="shrink-0" aria-label="Kaklen — inicio">
          <KaklenLogo tone="light" />
        </a>

        <nav aria-label="Navegación principal" className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="link-underline text-[14px] font-medium text-white/80 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:block">
          <ButtonLink href="/#contacto" variant="primary" className="!px-5 !py-2.5 !text-[13.5px]">
            Solicitar asesoría
          </ButtonLink>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          className="flex h-10 w-10 items-center justify-center rounded-full text-white md:hidden"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            ) : (
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </div>

      <div
        id="mobile-nav"
        aria-hidden={!open}
        inert={!open}
        className={`overflow-hidden border-t border-white/10 bg-navy-950 transition-[max-height] duration-300 ease-out md:hidden ${
          open ? "max-h-96" : "max-h-0 border-t-0"
        }`}
      >
        <nav aria-label="Navegación móvil" className="container-kaklen flex flex-col gap-1 py-4">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-[15px] font-medium text-white/85 hover:bg-white/5"
            >
              {link.label}
            </a>
          ))}
          <a
            href="/#contacto"
            onClick={() => setOpen(false)}
            className="mt-2 rounded-full bg-blue-500 px-5 py-3 text-center text-[15px] font-display font-semibold text-white"
          >
            Solicitar asesoría
          </a>
        </nav>
      </div>
    </header>
  );
}
