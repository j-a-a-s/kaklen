# Cuentas demo locales

El dataset multiempresa existe únicamente para desarrollo local, revisión visual, pruebas funcionales, E2E y demostraciones controladas.

| Perfil | Email | Contraseña | Organización |
|---|---|---|---|
| Empresa eventos | empresa.angela@demo.kaklen.local | KaklenDemo2026! | Ángela Producciones Demo SpA |
| Empresa perfumes | empresa.koke@demo.kaklen.local | KaklenDemo2026! | Koke Parfum Demo SpA |
| Persona natural | carolina.mendez@demo.kaklen.local | KaklenDemo2026! | Servicios Carolina Méndez |
| Persona natural | tomas.rivera@demo.kaklen.local | KaklenDemo2026! | Producciones Tomás Rivera |

Cada cuenta es `OWNER` de una sola organización. Todas las organizaciones usan país `CL`, moneda `CLP`, zona horaria `America/Santiago` y locale inicial `es`.

```bash
pnpm db:clear:demo
pnpm db:seed:demo
pnpm db:seed:demo
pnpm db:verify:demo
```

La segunda ejecución del seed conserva la misma huella lógica y no duplica datos. La limpieza acepta exclusivamente IDs, slugs y usuarios demo que coincidan de forma simultánea; una colisión con datos ajenos cancela la operación.

## Advertencias

- Usar estas cuentas solo en desarrollo local.
- No desplegar ni publicar estas cuentas en entornos accesibles públicamente.
- No reutilizar la contraseña demo en ninguna cuenta real.
- No ejecutar los comandos demo con `NODE_ENV=production` ni con un entorno público.
- El password se persiste únicamente como hash Argon2id; el valor visible existe en esta documentación para facilitar pruebas locales.
