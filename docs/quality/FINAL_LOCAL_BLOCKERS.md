# Bloqueantes finales de release local

Fecha de ejecución: 2026-07-17  
Rama: `main`  
SHA inicial: `d4ec1e8b5243b33cb5ffecab9ba22e37cfa0ea27`

## Baseline

Antes de modificar el código se confirmó que la rama local y `origin/main`
apuntaban al mismo SHA y que no existía divergencia. El baseline focalizado
obtuvo estos resultados:

- `pnpm forms:audit`: 25 formularios y 137 controles aprobados.
- `pnpm pdf:verify-money`: `PDF MONEY PARITY PASSED`.
- `pnpm scorecard:verify`: scorecard vigente en el SHA inicial.

## Bloqueos reproducidos

| Bloqueo | Causa raíz | Solución aplicada | Regresión automatizada |
| --- | --- | --- | --- |
| Errores numéricos genéricos y rutas técnicas en resúmenes | Los mensajes y labels se resolvían parcialmente en cada componente | `ValidationMessageResolver` tipado, labels humanos para `FormArray` y un único propietario visual en `FormFieldComponent` | Unitarios de validadores/resolver y `pnpm forms:audit` |
| Montos CLP tratados con dos decimales | La escala monetaria fija estaba incorporada al cálculo y a consumidores independientes | Política central en `@kaklen/shared`, cálculo con enteros escalados según moneda y validación repetida en API | Tests compartidos, API, web, sandbox, PDF y auditoría DB |
| Registros demo CLP con fracciones | El dataset anterior fue generado antes de la política de pesos enteros | Regeneración exclusiva de organizaciones demo administradas mediante `pnpm db:seed:demo`; no se modificaron datos externos | `pnpm db:verify:demo` y `pnpm db:verify:money` |
| PDF y recibos podían representar CLP con decimales | Formato y comparación asumían centavos | Formato compartido, comparación por unidades menores según moneda y detector de decimales CLP visibles | `pnpm pdf:verify-money` |
| Correo comercial habilitado en CI | La variable del workflow contradecía la política del producto | `COMMERCIAL_EMAIL_ENABLED` queda en `false`; correo transaccional de autenticación permanece habilitado | Quality Gate y revisión estática del workflow |

## Contratos cerrados

### Formularios

- `FormFieldComponent` es el único elemento que renderiza helper o error.
- El espacio de soporte conserva una altura mínima estable.
- Cliente, cotización y evento mantienen `WizardValidationState`, resumen
  limitado al paso activo, foco y scroll al primer error.
- Las rutas anidadas se muestran con índice humano, por ejemplo
  `Ítem 2: Cantidad`.
- Los mensajes nuevos están sincronizados en `es`, `en` y `pt-BR`.

### Dinero

- CLP usa escala 0 y `step="1"`.
- USD, EUR y BRL usan escala 2 y `step="0.01"`.
- Las cantidades conservan 3 decimales y los porcentajes 2.
- Un cambio de moneda no redondea ni trunca: revalida y bloquea el guardado.
- API, cotizaciones, catálogo, eventos, perfil profesional, portal, pagos,
  reembolsos, recibos, sandbox y PDF usan la política compartida.
- El backend devuelve `CLP_FRACTION_NOT_ALLOWED` al recibir pesos
  fraccionarios.
- `pnpm db:verify:money` revisa catálogo, cotizaciones y líneas, eventos y
  recursos, pagos, devoluciones, recibos y perfiles profesionales sin imprimir
  información sensible.

## Evidencia de cierre

La ejecución final debe conservar en verde:

- `pnpm lint`
- `pnpm test`
- `pnpm build`
- builds Angular `es`, `en` y `pt-BR`
- `pnpm verify:i18n-server`
- `pnpm forms:audit`
- `pnpm pdf:verify-money`
- `pnpm db:verify:money`
- `pnpm scorecard:verify`
- `pnpm quality:gate`

El gate remoto `Kaklen Quality Gate` se comprueba únicamente después de que el
commit validado haya sido publicado. No se crea tag, Pull Request ni merge como
parte de este sprint.
