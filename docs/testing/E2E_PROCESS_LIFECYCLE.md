# Ciclo de procesos E2E

## Causa raíz corregida

La configuración anterior delegaba el entorno a `playwright.config.mjs#webServer`. Playwright iniciaba `dev-full-i18n.mjs`, que a su vez iniciaba la API mediante `pnpm --filter @kaklen/api dev`. Al finalizar las pruebas, el cierre esperado enviaba `SIGTERM` al grupo de la API. El runner recursivo de pnpm interpretaba esa señal como un fallo del script y escribía:

```text
ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL
Command failed with signal "SIGTERM"
```

Además, `reuseExistingServer` podía aceptar una API o web iniciada fuera de Playwright. En ese caso las pruebas heredaban variables y estado de rate limiting ajenos al run y Playwright tampoco era responsable de limpiar esos procesos.

## Arquitectura

`pnpm e2e` ejecuta exclusivamente `scripts/run-e2e.mjs`. Playwright ya no inicia ni reutiliza servidores.

El runner sigue estas fases:

1. Comprueba que los puertos API y web estén libres.
2. Verifica PostgreSQL, Redis y Mailpit; inicia con Docker Compose solo los servicios ausentes.
3. Genera Prisma, aplica migraciones y construye paquetes y los locales `es`, `en` y `pt-BR`.
4. Inicia Nest directamente con Node y Nest CLI, sin `pnpm -r` ni `pnpm --filter` persistente.
5. Espera `GET /api/health/ready` y valida JSON con base de datos lista.
6. Inicia `scripts/serve-i18n.mjs` y valida HTML real en `/es/login`.
7. Ejecuta `pnpm exec playwright test` y conserva su código de salida.
8. Detiene Playwright, web y API en orden inverso. Detiene también los servicios Docker que el propio run haya iniciado.

Los procesos persistentes se crean como grupos independientes en sistemas POSIX. Esto permite terminar también a sus descendientes sin afectar al proceso padre ni a servidores ajenos.

## Health checks

- API: `http://localhost:3000/api/health/ready`, HTTP 200, JSON, `status=ok` y `checks.database=ok`.
- Web: `http://localhost:4200/es/login`, HTTP 200, MIME HTML y elemento raíz `<kaklen-root>`.

El polling usa backoff corto y el timeout `E2E_STARTUP_TIMEOUT_MS`, cuyo valor predeterminado es `120000`. Una página de error, un MIME incorrecto o un body incompleto no cuentan como disponibilidad.

## Señales y cleanup

Cada proceso conserva la bandera `shutdownRequestedByRunner`.

- `SIGTERM` después de activar la bandera es un cierre esperado.
- `SIGTERM`, otra señal o un código no cero antes del cleanup es un fallo de infraestructura.
- El runner espera `E2E_SHUTDOWN_TIMEOUT_MS` después de `SIGTERM`.
- Si el proceso no termina, envía `SIGKILL`, lo registra como warning y preserva el resultado principal.
- Si tampoco termina con `SIGKILL`, el cleanup es un fallo material.
- `Ctrl+C` solicita cleanup controlado y devuelve 130.

El runner nunca mata un proceso que ya ocupaba 3000 o 4200. Falla en preflight y pide liberar el puerto.

## Resultados y códigos

| Resultado | Código | Significado |
|---|---:|---|
| `E2E PASSED` | 0 | Playwright terminó correctamente y los servicios propios cerraron. |
| `E2E FAILED` | código de Playwright | Falló al menos una prueba o Playwright terminó de forma no exitosa. |
| `E2E INFRASTRUCTURE FAILED` | 2 | Falló preparación, proceso, health check, timeout o cleanup material. |
| `E2E INFRASTRUCTURE FAILED` | 130 | Interrupción local mediante `Ctrl+C`. |
| `E2E INFRASTRUCTURE FAILED` | 143 | Interrupción mediante `SIGTERM` externo. |

Los errores incluyen proceso, código, señal, fase y causa. `stderr` permanece visible y el runner no busca texto para reinterpretar el resultado.

## Comandos

```bash
pnpm e2e
pnpm e2e:ui
pnpm e2e:debug
```

`e2e:ui` mantiene API y web activas mientras la interfaz de Playwright permanezca abierta. Cerrar la UI completa las pruebas; `Ctrl+C` solicita el mismo cleanup controlado.

## Quality Gate

`pnpm quality:gate` ejecuta `pnpm e2e` como el control `E2E` y confía únicamente en su código de salida. No usa `|| true`, no filtra `SIGTERM` y se detiene inmediatamente ante un fallo real.

```text
QUALITY GATE FAILED
Control: E2E
Cause: exit 1
```

`QUALITY GATE PASSED` se imprime solo cuando todos los controles terminan con código 0.

## Troubleshooting

- **Puerto 3000 o 4200 ocupado:** detenga el entorno de desarrollo que inició manualmente y repita `pnpm e2e`.
- **API no disponible:** revise el bloque `[e2e:api]` y el resultado de `/api/health/ready`.
- **Web no disponible:** confirme que los tres builds localizados existan y revise `[e2e:web]`.
- **Timeout de inicio:** aumente `E2E_STARTUP_TIMEOUT_MS` solo si los logs muestran progreso real.
- **SIGKILL:** revise el warning `[e2e:cleanup]`; indica que un hijo no respetó el cierre normal.
- **Fallo de Playwright:** abra los artefactos de `test-results` o `playwright-report`; el código original se conserva.
