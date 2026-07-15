# UX Audit

## Alcance

Auditoría transversal de navegación, auth, organizaciones, dashboard, clientes, catálogo, cotizaciones y eventos. Se preservaron contratos de API, RBAC, i18n y lógica de negocio.

## Diagnóstico anterior

| Hallazgo | Impacto |
| --- | --- |
| Marca expresada principalmente como texto | Menor identidad y confianza percibida |
| Dashboard centrado en datos de cuenta | No indicaba prioridades ni siguiente acción |
| Navegación plana | Mayor carga para distinguir contexto global y organización |
| Listas con filas genéricas | Baja velocidad de escaneo y estados poco visibles |
| Estados vacíos como párrafos | No ayudaban a completar la primera tarea |
| Formularios internos reutilizando layout de auth | Jerarquía inconsistente dentro del producto |
| Carga sin reserva visual | Sensación de lentitud y saltos de layout |
| Header móvil denso | Riesgo de desbordamiento y objetivos táctiles pequeños |

La evidencia base está en `docs/design/screenshots/login-before.png`.

## Correcciones realizadas

### Sistema global

- Tokens de color, espaciado, tipografía, radio, sombra y estados.
- Shell autenticado con sidebar por organización y RBAC.
- Header público con logo, navegación y único selector de idioma.
- Paleta de comandos para navegación rápida.
- Foco visible, movimiento reducido y base de modo oscuro.

### Auth

- Logo compacto en header y firma institucional en escritorio.
- Formulario como tarea principal, sin selector de idioma duplicado.
- Copia breve, validaciones próximas y versión técnica oculta.

### Dashboard

- Saludo contextual y organización activa.
- Métricas enlazadas, acciones rápidas y skeleton.
- Onboarding con progreso y siguiente paso recomendado.
- Estado vacío para crear la primera organización.

### Módulos CRUD

- Clientes: identidad por iniciales, metadatos y estado legible.
- Catálogo: distinción visual entre producto y servicio, precio y estado.
- Cotizaciones: número, cliente, vigencia, total y estado de pipeline.
- Eventos: fecha reconocible, rango horario, ubicación y estado.
- Organizaciones: carga, estado vacío y tarjetas responsive con activación explícita.
- Formularios internos migrados al shell de trabajo.

## Evidencia posterior

- `docs/design/screenshots/login-after-desktop.png`
- `docs/design/screenshots/login-after-mobile.png`

## Métricas esperadas

Estas cifras son hipótesis que deben validarse con analítica y pruebas de usabilidad:

| Métrica | Cambio estimado |
| --- | --- |
| Tiempo hasta la primera acción útil | 30 a 45% menor |
| Decisiones necesarias para encontrar un módulo | 20 a 30% menor |
| Finalización del onboarding inicial | 20 a 30% mayor |
| Tiempo de recuperación ante un formulario inválido | 15 a 25% menor |

## Pendientes reales

- Selección masiva y configuración de columnas requieren priorización de producto y soporte consistente en listados.
- Imágenes de catálogo requieren una fuente de datos y estrategia de almacenamiento antes de diseñar upload y fallback definitivo.
- Centro de ayuda, tour y video breve requieren contenido y medición de abandono.
- Activación completa de modo oscuro necesita validación visual de todos los estados; los tokens ya están preparados.
- Las métricas estimadas necesitan instrumentación y sesiones con usuarios para convertirse en resultados observados.

