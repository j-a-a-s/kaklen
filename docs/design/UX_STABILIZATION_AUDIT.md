# UX Stabilization Audit

## Alcance

Esta auditoría registra el sprint final de estabilización de los flujos principales de Kaklen. La evidencia compara las capturas base del MVP con las vistas posteriores al cambio y vincula cada decisión con una prueba automatizada. Los datos mostrados son locales y reproducibles.

## Navegación y shell

**Problema anterior.** Las rutas hijas podían mantener más de un enlace resaltado y la cabecera móvil conservaba demasiadas acciones. El menú lateral no expresaba completamente su estado modal ni devolvía el foco al cerrarse.

**Solución.** La ruta raíz de organización usa coincidencia exacta y cada módulo usa coincidencia parcial, con `aria-current="page"`. En móvil la cabecera se reduce a menú, marca y perfil. Idioma, organizaciones, configuración y logout se concentran en el menú de cuenta. El drawer ocupa 86% del ancho, añade overlay, bloqueo de scroll, cierre por overlay o `Escape`, focus trap y retorno de foco.

**Principio UX.** Orientación consistente, divulgación progresiva y operación completa por teclado.

**Evidencia.** `screenshots/ux-before-mobile-menu.png` y `screenshots/ux-after-mobile-menu.png`; `screenshots/ux-before-dashboard.png` y `screenshots/ux-after-dashboard.png`.

**Test asociado.** `scripts/ux-stabilization.test.mjs`: navegación actual, drawer, foco y limpieza de listeners. `e2e/accessibility.spec.mjs`: landmarks, nombres accesibles y ausencia de overflow.

## Jerarquía de acciones

**Problema anterior.** Acciones de éxito, primarias y destructivas compartían apariencia o competían en la misma línea. Algunas operaciones irreversibles usaban confirmaciones nativas sin contexto.

**Solución.** Azul identifica la acción primaria, verde confirma resultados de negocio, rojo queda reservado para consecuencias destructivas y los secundarios usan superficie neutral. Archivar, cancelar y quitar acceso se mueven a “Más acciones”, usan un diálogo accesible con consecuencia explícita, bloquean doble envío y emiten una notificación. Archivar clientes y catálogo permite deshacer cuando es seguro.

**Principio UX.** Prevención de errores, jerarquía visual y recuperación controlada.

**Evidencia.** `screenshots/ux-before-clients.png`, `screenshots/ux-after-clients.png`, `screenshots/ux-before-events.png` y `screenshots/ux-after-events.png`.

**Test asociado.** `scripts/ux-stabilization.test.mjs`: colores semánticos, menú secundario, diálogo, estado busy y Escape.

## Lenguaje y formatos

**Problema anterior.** Estados, roles y valores regionales podían exponer claves técnicas como `IN_PROGRESS`, `VIEWER`, `CLP` o `America/Santiago`. Los montos CLP podían mostrar decimales innecesarios.

**Solución.** Un catálogo tipado traduce estados, roles, prioridades, países, monedas y zonas horarias en español, inglés y portugués brasileño. Las claves persistidas siguen intactas. Los montos usan `Intl.NumberFormat`; CLP entero se presenta como `$59.500` sin decimales.

**Principio UX.** Hablar el idioma de la persona sin degradar los contratos técnicos.

**Evidencia.** `screenshots/ux-before-settings.png` y `screenshots/ux-after-settings.png`.

**Test asociado.** `scripts/ux-stabilization.test.mjs`: cobertura del catálogo tipado y formato CLP. Los builds localizados validan todos los IDs XLIFF.

## Formularios y filtros

**Problema anterior.** El alta de clientes se percibía como un bloque largo y los filtros ocupaban demasiado espacio en pantallas pequeñas. Los valores de configuración requerían conocer códigos internos.

**Solución.** Cliente se organiza en datos principales, contacto, dirección e información adicional, con resumen de errores, ejemplos, RUT, prefijo telefónico y región/ciudad. Los filtros son compactos en escritorio y colapsables en móvil, muestran chips activos y permiten limpiar. Configuración usa opciones amigables y validadas para país, moneda, zona horaria, formatos e idioma predeterminado.

**Principio UX.** Agrupación significativa, reconocimiento antes que memoria y reducción de carga visual.

**Evidencia.** `screenshots/ux-before-client-create.png`, `screenshots/ux-after-client-create.png`, `screenshots/ux-before-mobile-clients.png` y `screenshots/ux-after-mobile-clients.png`.

**Test asociado.** `scripts/ux-stabilization.test.mjs`: secciones de cliente, RUT, filtros móviles, chips y selects de configuración.

## Cotizaciones guiadas

**Problema anterior.** Crear una cotización exponía todos los campos y cálculos en una sola vista, sin una secuencia clara ni validación por contexto.

**Solución.** El flujo se divide en cuatro etapas: cliente y vigencia, productos o servicios, descuentos e impuestos, y revisión. Cada transición valida solo la etapa actual. El resumen de subtotal, descuentos, IVA y total permanece fijo en escritorio y se vuelve expandible en móvil.

**Principio UX.** Divulgación progresiva, feedback inmediato y visibilidad del impacto económico.

**Evidencia.** `screenshots/ux-before-quotation-create.png` y `screenshots/ux-after-quotation-create.png`.

**Test asociado.** `scripts/ux-stabilization.test.mjs`: cuatro etapas, validación, navegación y resumen responsive.

## Dashboard y acciones rápidas

**Problema anterior.** El onboarding completo seguía ocupando espacio operativo y las métricas no aprovechaban de forma consistente tablet y escritorio. El detalle de cliente mostraba acciones sin considerar disponibilidad de contacto o permiso.

**Solución.** El onboarding al 100% se compacta y permite abrir el detalle. Las métricas usan dos columnas en móvil, tres en tablet y cinco en escritorio. Llamar, WhatsApp y correo aparecen solo cuando existe el dato; cotización y evento requieren su permiso RBAC.

**Principio UX.** Priorizar trabajo pendiente y mostrar solo acciones viables.

**Evidencia.** `screenshots/ux-before-dashboard.png`, `screenshots/ux-after-dashboard.png` y `screenshots/ux-after-client-detail.png`.

**Test asociado.** `scripts/ux-stabilization.test.mjs`: breakpoints, onboarding compacto y disponibilidad de acciones rápidas.

## Criterio de cierre

El sprint se considera cerrado cuando lint, tests, cobertura, build, E2E, accesibilidad y release check finalizan correctamente; los tres locales construyen sin mensajes faltantes; y las capturas posteriores muestran los cambios en los viewports definidos. Cualquier restricción del entorno se reporta separada de un defecto del producto.
