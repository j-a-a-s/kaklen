# Gobernanza del proyecto

## Propiedad y autoridad

Kaklen es propiedad de `j-a-a-s`, quien actúa como owner y maintainer actual.
Las decisiones finales sobre dirección, alcance, aceptación de cambios y
operación del repositorio corresponden exclusivamente al owner.

## Clasificación de cambios

- Los cambios rutinarios incluyen documentación, pruebas, mantenimiento y
  correcciones acotadas que no alteran contratos sensibles.
- Los cambios sensibles incluyen autenticación, seguridad, permisos, datos,
  migraciones, infraestructura, configuración productiva y finanzas. Requieren
  revisión explícita del owner y evidencia completa del Quality Gate.
- Los releases requieren validación estricta, evidencia versionada y aprobación
  directa del owner.

Todo cambio integrado en `main` debe superar el Quality Gate aplicable. No se
permite omitir controles para acelerar una entrega.

## Releases y publicación

Solo `j-a-a-s` puede autorizar releases, crear tags, publicar artefactos o
representar oficialmente al proyecto. Ninguna contribución, issue o pull
request delega esa autoridad.

## Documentación y dependencias

La documentación canónica debe actualizarse junto con el cambio que modifica su
contrato y no debe duplicarse en fuentes contradictorias. Las dependencias se
gestionan conforme a [Dependency Updates](DEPENDENCY_UPDATES.md), con revisión
del impacto, licencias de terceros y controles automatizados.

## Historial de main

Se prohíbe el force push y toda reescritura del historial de `main`. Las
correcciones posteriores se realizan mediante nuevos commits auditables.
