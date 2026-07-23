export type SolutionIcon =
  | "compass"
  | "layers"
  | "grid"
  | "bolt"
  | "structure"
  | "spark"
  | "chat"
  | "chart"
  | "link"
  | "cloud";

export interface Solution {
  id: string;
  icon: SolutionIcon;
  name: string;
  description: string;
  benefit: string;
}

export const solutions: Solution[] = [
  {
    id: "strategy",
    icon: "compass",
    name: "Estrategia y transformación digital",
    description: "Hoja de ruta clara para modernizar procesos y modelos de negocio.",
    benefit: "Decisiones con datos, no con intuición."
  },
  {
    id: "platforms",
    icon: "layers",
    name: "Desarrollo de plataformas",
    description: "Productos digitales a medida, desde el primer prototipo hasta la escala.",
    benefit: "Software que crece con el negocio."
  },
  {
    id: "saas",
    icon: "grid",
    name: "Productos SaaS",
    description: "Diseño y construcción de productos de suscripción multi-cliente.",
    benefit: "Ingresos recurrentes, arquitectura lista desde el día uno."
  },
  {
    id: "automation",
    icon: "bolt",
    name: "Automatización de procesos",
    description: "Eliminamos trabajo manual repetitivo con integraciones y flujos automáticos.",
    benefit: "Más horas para lo que importa."
  },
  {
    id: "architecture",
    icon: "structure",
    name: "Arquitectura tecnológica",
    description: "Sistemas pensados para durar: modulares, seguros y observables.",
    benefit: "Menos deuda técnica, más velocidad futura."
  },
  {
    id: "experience",
    icon: "spark",
    name: "Experiencia digital",
    description: "Interfaces claras que reducen fricción y aumentan conversión.",
    benefit: "Productos que las personas entienden a la primera."
  },
  {
    id: "consulting",
    icon: "chat",
    name: "Consultoría e innovación",
    description: "Acompañamiento cercano para evaluar y priorizar nuevas iniciativas.",
    benefit: "Menos apuestas a ciegas."
  },
  {
    id: "intelligence",
    icon: "chart",
    name: "Inteligencia empresarial",
    description: "Paneles y métricas que conectan datos operativos con decisiones.",
    benefit: "Visibilidad real del negocio."
  },
  {
    id: "integration",
    icon: "link",
    name: "Integración de sistemas",
    description: "Conectamos herramientas existentes para que trabajen como una sola.",
    benefit: "Menos silos, más contexto compartido."
  },
  {
    id: "infrastructure",
    icon: "cloud",
    name: "Infraestructura y nube",
    description: "Bases técnicas confiables, con seguridad y costos bajo control.",
    benefit: "Estabilidad que no depende de una sola persona."
  }
];
