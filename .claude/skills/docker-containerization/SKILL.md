---
name: docker-containerization
description: Creación y revisión de Dockerfiles seguros y optimizados. Úsalo al escribir o auditar imágenes Docker, reducir su tamaño o aplicar multi-stage builds y ejecución con privilegios mínimos.
---

# Docker containerization

## Cuándo usar
- Al crear o modificar un `Dockerfile`.
- Al reducir el tamaño de una imagen o su superficie de ataque.

## Reglas
- Usa **multi-stage builds**: una etapa para compilar y otra mínima para ejecutar.
- Ejecuta el contenedor con un usuario no root (`USER node` u otro usuario dedicado).
- Usa imágenes base con versión fijada (no `latest`) y preferiblemente slim o alpine.
- Nunca copies secretos al image layer; pásalos como variables de entorno o secrets en build time (`--mount=type=secret`).
- Usa `.dockerignore` para excluir `node_modules`, `.env`, `.git` y artefactos locales.
- Ordena las instrucciones para aprovechar la caché (dependencias antes que el código fuente).
- Declara `HEALTHCHECK` cuando el servicio lo permita.

## Validación
- Confirma que la imagen final no contiene herramientas de compilación ni credenciales.
- Revisa el tamaño de la imagen antes y después del cambio.
