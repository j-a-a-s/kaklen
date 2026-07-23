import type { Metadata } from "next";
import { Header } from "@/components/marketing/header";
import { Footer } from "@/components/marketing/footer";
import { serializeJsonLd } from "@/lib/safe-json-ld";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4300";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Kaklen — Inversiones & Tecnología",
    template: "%s · Kaklen"
  },
  description:
    "Kaklen impulsa soluciones digitales, plataformas empresariales e innovación con visión estratégica y propósito. Invertimos hoy, construimos el mañana.",
  keywords: [
    "Kaklen",
    "inversiones y tecnología",
    "transformación digital",
    "desarrollo de plataformas",
    "innovación empresarial",
    "soluciones tecnológicas",
    "plataformas digitales",
    "consultoría tecnológica"
  ],
  openGraph: {
    type: "website",
    locale: "es_CL",
    url: SITE_URL,
    siteName: "Kaklen",
    title: "Kaklen — Inversiones & Tecnología",
    description: "Invertimos hoy, construimos el mañana."
  },
  twitter: {
    card: "summary_large_image",
    title: "Kaklen — Inversiones & Tecnología",
    description: "Invertimos hoy, construimos el mañana."
  },
  robots: { index: true, follow: true }
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Kaklen",
  url: SITE_URL,
  sameAs: [process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? "https://instagram.com/kaklen.cl"],
  slogan: "Invertimos hoy, construimos el mañana."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <a
          href="#contenido"
          className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-transform focus:translate-y-0"
        >
          Saltar al contenido
        </a>
        <Header />
        <main id="contenido">{children}</main>
        <Footer />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationJsonLd) }}
        />
      </body>
    </html>
  );
}
