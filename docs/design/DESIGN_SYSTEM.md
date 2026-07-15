# Kaklen Design System

## Propósito

El sistema visual de Kaklen prioriza claridad operativa, confianza y velocidad. Cada pantalla debe responder, en este orden, dónde está la persona, qué información importa, cuál es la siguiente acción y qué consecuencia tendrá.

## Principios

1. **Trabajo antes que decoración.** La interfaz es compacta, predecible y fácil de escanear.
2. **Una acción primaria por contexto.** Las alternativas se presentan como acciones secundarias.
3. **Estado siempre visible.** Carga, vacío, error, permisos y resultado tienen tratamientos explícitos.
4. **Consistencia transversal.** Auth, organizaciones, CRM, catálogo, cotizaciones y eventos comparten lenguaje visual.
5. **Accesibilidad de base.** Contraste AA, foco visible, navegación por teclado y objetivos táctiles de al menos 44 px.

## Marca

| Variante | Uso | Reglas |
| --- | --- | --- |
| Compacta | Barra superior y navegación | Mantener proporción, no recolorear, no añadir texto adyacente |
| Institucional | Login y registro en escritorio | Usar sobre superficie blanca, conservar relación de aspecto, ocultar en móvil para priorizar el formulario |

Los archivos fuente viven en `apps/web/public/brand`. Las imágenes son decorativas dentro del componente porque el nombre accesible `Kaklen` ya está presente como texto para lectores de pantalla.

## Tokens

Los tokens se definen en `apps/web/src/design-system.css`.

| Grupo | Escala |
| --- | --- |
| Espaciado | 4, 8, 12, 16, 20, 24, 32 y 40 px |
| Radios | 4, 6 y 8 px; el radio completo se reserva para avatar y estado |
| Superficies | fondo, superficie, superficie secundaria y elevada |
| Texto | principal, secundario y tenue |
| Semántica | marca, éxito, advertencia, peligro e información |
| Sombras | `sm`, `md` y `lg`, aplicadas solo cuando expresan elevación |

La paleta combina neutros claros, azul de marca, verde de éxito, ámbar de advertencia y rojo de error. No se usan gradientes ni color como único medio para comunicar estado.

### Semántica de acciones

| Intención | Color | Uso |
| --- | --- | --- |
| Primaria | Azul de marca | Crear, guardar, continuar o abrir el flujo principal |
| Exitosa | Verde | Aprobar, confirmar o completar una operación |
| Destructiva | Rojo | Archivar, cancelar de forma definitiva o quitar acceso |
| Secundaria | Superficie neutral | Volver, editar filtros o ejecutar acciones reversibles |

Una vista mantiene una sola acción primaria dominante. Las acciones destructivas viven en un menú secundario cuando no son la tarea principal y siempre explican su consecuencia antes de ejecutarse.

## Tipografía

- Familia: pila nativa de sistema con Inter como preferencia.
- Cuerpo: 16 px y altura de línea 1.5.
- Texto auxiliar: 12 a 14 px.
- Títulos de vista: 28 a 32 px según el contenedor, nunca según el ancho del viewport.
- Máximo recomendado: tres tamaños dominantes por vista.
- El espaciado entre letras se mantiene en `0`.

## Componentes base

- Botón primario: confirma la acción principal.
- Botón secundario: navegación o acción reversible.
- Botón destructivo: solo para consecuencias irreversibles o archivado explícito.
- Campo: etiqueta visible, ayuda breve y error próximo al control.
- Badge de estado: texto, color y borde semánticos.
- Empty state: icono, explicación y siguiente acción.
- Skeleton: reserva dimensiones y evita saltos de layout.
- Toast: confirmación breve, no reemplaza errores de formulario.
- Command palette: navegación rápida accesible desde teclado.

## Layout responsive

| Rango | Comportamiento |
| --- | --- |
| Menor a 700 px | Una columna, acciones de ancho completo y contenido prioritario |
| 700 a 959 px | Grillas compactas, formularios con mayor respiración |
| Desde 960 px | Sidebar persistente y contenido operacional en dos columnas cuando aporta valor |

Los controles de formato fijo tienen dimensiones estables. Ninguna vista debe producir scroll horizontal en 390, 820 o 1440 px.

## Accesibilidad

- Foco `:focus-visible` con contorno de 3 px.
- Movimiento reducido bajo `prefers-reduced-motion`.
- Iconos decorativos con `aria-hidden="true"`.
- Botones de icono con nombre accesible.
- Estados comunicados con texto, no solo color.
- Landmarks `header`, `nav`, `main` y `aside` coherentes.
- El enlace activo usa `aria-current="page"` y solo un elemento de la navegación puede estar activo a la vez.
- El drawer móvil bloquea el scroll de fondo, mantiene el foco dentro, cierra con `Escape` y devuelve el foco al disparador.
- Modo oscuro preparado por tokens bajo `[data-theme="dark"]`; su activación queda fuera de este alcance.
