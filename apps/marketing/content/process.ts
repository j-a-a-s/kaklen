export interface ProcessStep {
  id: string;
  step: string;
  title: string;
  description: string;
}

export const process: ProcessStep[] = [
  {
    id: "discover",
    step: "01",
    title: "Descubrimos",
    description: "Comprendemos el desafío, el mercado y la oportunidad."
  },
  {
    id: "design",
    step: "02",
    title: "Diseñamos",
    description: "Creamos una estrategia clara y una experiencia centrada en las personas."
  },
  {
    id: "build",
    step: "03",
    title: "Construimos",
    description: "Desarrollamos tecnología sólida, segura y escalable."
  },
  {
    id: "validate",
    step: "04",
    title: "Validamos",
    description: "Medimos resultados, reducimos riesgos y mejoramos continuamente."
  },
  {
    id: "scale",
    step: "05",
    title: "Escalamos",
    description: "Preparamos la solución para crecer de manera sostenible."
  }
];
