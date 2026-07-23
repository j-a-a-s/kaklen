export type PlatformStatus = "concept" | "alpha" | "beta" | "available";

export interface Platform {
  id: string;
  name: string;
  tagline: string;
  description: string;
  status: PlatformStatus;
  href?: string;
}

const STATUS_LABEL: Record<PlatformStatus, string> = {
  concept: "En concepto",
  alpha: "Alpha",
  beta: "Beta",
  available: "Disponible"
};

export function platformStatusLabel(status: PlatformStatus): string {
  return STATUS_LABEL[status];
}

export const platforms: Platform[] = [
  {
    id: "kapiar",
    name: "Kapiar",
    tagline: "Dale vida a tu mundo.",
    description:
      "Spatial Commerce Platform: comercio en realidad aumentada y mixta que conecta marcas con clientes directamente en el espacio físico.",
    status: "alpha"
  }
];
