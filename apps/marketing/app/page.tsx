import { Hero } from "@/components/marketing/hero";
import { Pillars } from "@/components/marketing/pillars";
import { Solutions } from "@/components/marketing/solutions";
import { Platforms } from "@/components/marketing/platforms";
import { Manifesto } from "@/components/marketing/manifesto";
import { Process } from "@/components/marketing/process";
import { Contact } from "@/components/marketing/contact";
import { serializeJsonLd } from "@/lib/safe-json-ld";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4300";

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Kaklen",
  url: SITE_URL
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <Pillars />
      <Solutions />
      <Platforms />
      <Manifesto />
      <Process />
      <Contact />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(websiteJsonLd) }}
      />
    </>
  );
}
