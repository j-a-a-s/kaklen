# UX Guidelines

## Audiencia

Kaklen debe funcionar para personas con alta carga operativa, poca experiencia digital, estrés o visión reducida. La interfaz evita depender de memoria, precisión motora o conocimiento técnico.

## Jerarquía de cada pantalla

1. Nombre de la vista y organización activa.
2. Estado o dato que requiere atención.
3. Acción primaria.
4. Opciones secundarias y filtros.
5. Ayuda contextual y detalles.

## Navegación

- La barra superior contiene marca, contexto de organización, cuenta, idioma y comandos globales.
- El sidebar contiene módulos y respeta RBAC tanto en visibilidad como en backend.
- La ruta activa debe ser perceptible sin depender solo del color.
- En móvil, el menú se abre con un control de 44 px y se cierra después de navegar.
- La paleta de comandos ofrece accesos rápidos sin duplicar lógica de permisos.

## Formularios

- Pedir solo datos necesarios para completar la tarea.
- Etiquetas siempre visibles. El placeholder no sustituye una etiqueta.
- Presentar ayuda antes del error cuando una regla pueda ser ambigua.
- Mostrar el error cerca del campo y conservar los datos válidos.
- Deshabilitar el envío durante la operación y comunicar el estado en el texto del botón.
- Confirmar acciones destructivas y explicar la consecuencia con lenguaje concreto.

## Listas y operaciones CRUD

- Encabezado con título, descripción breve y acción principal.
- Búsqueda y filtros antes de la lista.
- Filas con identidad visual, estado, metadatos y acciones predecibles.
- Paginación estable sin reordenamientos inesperados.
- En móvil, las filas se transforman en bloques escaneables sin ocultar la acción principal.
- Selección masiva y configuración de columnas se incorporarán cuando el caso de uso y la API lo justifiquen.

## Estados obligatorios

| Estado | Tratamiento |
| --- | --- |
| Carga | Skeleton con dimensiones del contenido esperado |
| Vacío inicial | Explicación útil y acción para crear el primer registro |
| Sin resultados | Mantener filtros visibles y ofrecer limpiarlos |
| Error recuperable | Mensaje humano y acción para reintentar |
| Sin permisos | Explicar la limitación sin exponer información privada |
| Sin conexión | Diferenciarlo de credenciales inválidas o error de validación |
| Éxito | Toast breve y actualización inmediata de la vista |

## Contenido

- Usar verbos concretos: Crear cliente, Guardar cambios, Archivar evento.
- Evitar terminología técnica, culpa o mensajes genéricos.
- Mantener nombres técnicos, permisos, enums y códigos de error sin traducir.
- Traducir todo texto visible mediante Angular i18n para `es`, `en` y `pt-BR`.
- Fechas, números y moneda dependen de la configuración regional, no del idioma de interfaz.

## Seguridad percibida

- El logout limpia todo contexto de usuario y organización.
- El login nunca muestra datos de la sesión anterior.
- La versión del producto permanece oculta y accesible solo mediante el mecanismo técnico existente.
- Las acciones no autorizadas se ocultan en frontend y se rechazan de nuevo en backend.

