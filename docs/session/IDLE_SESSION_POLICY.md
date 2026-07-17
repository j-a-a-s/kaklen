# Política de sesión inactiva

## Tiempos

- `SESSION_WARNING_SECONDS=240`: abre una advertencia accesible.
- `SESSION_IDLE_SECONDS=300`: ejecuta logout completo.
- Los valores llegan al frontend mediante `runtime-config.json` y deben cumplir `warning < idle`.

## Actividad y coordinación

`SessionIdleService` considera actividad de usuario los eventos de teclado, puntero, touch, scroll y navegación. Polling, refresh silencioso y timers no renuevan la sesión. Un `BroadcastChannel` con ámbito Kaklen propaga actividad y logout entre pestañas.

La advertencia presenta countdown, continuar y cerrar ahora. Al vencer se llama al logout backend, se elimina el access token en memoria, se limpia organización/permisos/caches, se cierran overlays y se navega a login con reemplazo de historial.

## Verificación

- Fake timers cubren advertencia, continuidad y expiración.
- Tests de canal cubren actividad remota y logout remoto.
- El cleanup elimina listeners, timers y canal al destruir.
- El E2E de logout comprueba recarga y ausencia de datos anteriores.
