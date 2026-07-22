# Actualizaciones de dependencias

Dependabot mantiene pnpm, GitHub Actions, imágenes Docker y el provider
Terraform sin modificar la política de calidad del repositorio.

## Política automática

- Frecuencia semanal, los lunes a las `09:00` en `America/Santiago`.
- Branch objetivo: `main`.
- Límite de pull requests abiertos: cinco para pnpm; tres para GitHub Actions,
  Docker y Terraform.
- Actualizaciones npm minor y patch agrupadas por dependencias de runtime o de
  desarrollo.
- Actualizaciones minor y patch de GitHub Actions e imágenes Docker agrupadas
  por ecosistema. Terraform actualiza el provider fijado desde el root staging.
- Actualizaciones major separadas en todos los ecosistemas para conservar una
  revisión explícita.
- Sin auto-merge.

La agrupación reduce ruido; no convierte una actualización en aprobación. Los
pull requests siguen sujetos a revisión, tests y Quality Gate.

## Revisión

1. Lee changelog, notas de seguridad y breaking changes del proveedor.
2. Comprueba cambios de lockfile y dependencias transitivas inesperadas.
3. Ejecuta `pnpm check` para feedback rápido.
4. Ejecuta `pnpm quality:gate` antes de aprobar.
5. Si el cambio prepara una release, ejecuta `pnpm release:check:strict` y
   conserva la evidencia requerida.
6. Revisa migraciones o generación de código cuando Prisma, Angular o NestJS lo
   indiquen, aunque la actualización sea minor.

## Excepciones

No ignores una versión ni cambies el calendario para ocultar un fallo. Documenta
la razón, el impacto y una fecha de revisión en el pull request o en una decisión
de arquitectura. Los parches urgentes de seguridad pueden abrirse manualmente,
pero deben atravesar los mismos controles.
