# Component Library

## Componentes Angular

### BrandLogoComponent

`apps/web/src/app/shared/brand-logo.component.ts`

```html
<kaklen-brand-logo />
<kaklen-brand-logo variant="signature" />
```

La variante compacta pertenece al header. La institucional se reserva para auth en escritorio.

### EmptyStateComponent

`apps/web/src/app/shared/empty-state.component.ts`

```html
<kaklen-empty-state icon="◎" [title]="emptyTitle" [description]="emptyDescription">
  <a class="button-link" routerLink="new">Crear cliente</a>
</kaklen-empty-state>
```

El contenido proyectado permite una acción real sin acoplar el componente a rutas de negocio.

### StatusBadgeComponent

`apps/web/src/app/shared/status-badge.component.ts`

```html
<kaklen-status-badge [status]="client.status" [label]="statusLabel(client.status)" />
```

Admite estados activos, inactivos, archivados y estados de flujo. El texto visible mantiene el componente comprensible sin color.

### CommandPaletteComponent

`apps/web/src/app/shared/command-palette.component.ts`

Se integra una sola vez en el shell autenticado. Recibe `organizationId`, consulta permisos existentes y elimina listeners al destruirse. El diálogo conserva foco, permite Escape y no agrega dependencias.

### NotificationContainerComponent

`apps/web/src/app/shared/notifications/notification-container.component.ts`

Centraliza confirmaciones y errores transitorios. Los errores de formulario permanecen junto a los campos.

## Patrones CSS

| Patrón | Uso |
| --- | --- |
| `.dashboard-shell` | Contenedor principal autenticado |
| `.dashboard-header` | Título, contexto y acción de vista |
| `.dashboard-panel` | Herramienta o agrupación operativa, no sección decorativa |
| `.metric-card-grid` | Indicadores enlazados a su módulo |
| `.quick-action-grid` | Acciones frecuentes autorizadas |
| `.item-list` / `.item-row` | Listados CRUD responsive |
| `.form-panel` | Formulario de una tarea concreta |
| `.empty-state` | Ausencia inicial o sin resultados |
| `.status-badge` | Estado semántico textual |

## Reglas de extensión

1. Reutilizar tokens antes de añadir valores literales.
2. Añadir una variante solo cuando cambia semántica o comportamiento.
3. Mantener API tipada y sin `any`.
4. Incluir nombre accesible, foco visible y estado disabled.
5. Probar 390, 820 y 1440 px.
6. Extraer texto visible a XLIFF antes de integrar.

