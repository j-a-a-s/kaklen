# Validación responsive

## Matriz obligatoria

| Viewport | Perfil | Superficies automatizadas |
| --- | --- | --- |
| 320x568 | móvil compacto | dashboard, cliente, cotización, portal y pago |
| 390x844 | móvil | navegación, dashboard, formularios, portal y pago |
| 768x1024 | tablet vertical | formularios, tablas, portal y pago |
| 820x1180 | tablet amplia | dashboard, formularios, portal y pago |
| 1366x768 | portátil | acciones, wizard, portal y pago |
| 1440x900 | escritorio | recorrido completo en es/en/pt-BR |
| 1920x1080 | escritorio amplio | grids, headers, portal y pago |

## Criterios

- `documentElement.scrollWidth <= clientWidth` en cada caso.
- Formularios pasan a una columna cuando el espacio no admite dos.
- Acciones secundarias se agrupan sin sacar el botón principal del viewport.
- Menús se anclan a su trigger y el coordinador mantiene una sola instancia abierta.
- Tooltips usan posición limitada al viewport.
- El resumen de cotización no cubre campos ni botones.
- Tablas operativas permiten desplazamiento interno solo cuando conservar columnas es necesario.
- Portal público y checkout son mobile-first.

## Evidencia

`e2e/assisted-product.spec.mjs` recorre los siete viewports sobre dashboard y formularios. `e2e/mvp.spec.mjs` repite la matriz sobre portal y pago y valida los tres builds localizados. `e2e/accessibility.spec.mjs` cubre foco, landmarks, nombres accesibles y overflow. Todos forman parte de `pnpm quality:gate`.
