---
name: cicd-pipelines-github-actions
description: Diseño de pipelines CI/CD automatizados con GitHub Actions (tests, análisis de seguridad, build de imágenes y despliegue). Úsalo al crear o modificar workflows de integración y despliegue continuo.
---

# CI/CD pipelines with GitHub Actions

## Cuándo usar
- Al crear o editar archivos en `.github/workflows/`.
- Al automatizar build, pruebas o despliegues.

## Reglas
- Ejecuta lint, tests y auditoría de dependencias en cada pull request antes del merge.
- Fija las acciones a un SHA o versión concreta, no a `main`.
- Usa `permissions:` con el mínimo necesario (`contents: read` por defecto).
- Guarda secretos en GitHub Secrets o en un entorno protegido; nunca en el YAML.
- Escanea las imágenes Docker antes de publicarlas.
- Despliega solo desde la rama protegida y, en producción, con aprobación manual.
- Usa `concurrency` para evitar despliegues simultáneos.

## Validación
- Verifica que el pipeline falla si un test o un escaneo de seguridad falla.
- Confirma que el despliegue deja la aplicación accesible y con volúmenes persistentes intactos.
