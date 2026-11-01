---
name: docker-compose-orchestration
description: Orquestación de servicios con Docker Compose (frontend, backend, base de datos, Redis) con redes y volúmenes aislados. Úsalo al modificar docker-compose.yml, definir dependencias entre servicios o gestionar persistencia.
---

# Docker Compose orchestration

## Cuándo usar
- Al editar `docker-compose.yml` o sus variantes por entorno.
- Al definir cómo se comunican frontend, backend, base de datos y Redis.

## Reglas
- Define redes internas explícitas: la base de datos y Redis solo deben estar en la red interna, nunca publicados al host.
- Reutiliza redes y volúmenes lógicos en lugar de crear nuevos por servicio.
- Usa `depends_on` con `condition: service_healthy` y `healthcheck` en cada servicio con estado.
- Lee la configuración desde `.env` o `env_file`, sin valores sensibles escritos en el YAML.
- Limita recursos con `deploy.resources` o `mem_limit` y usa `restart: unless-stopped`.
- Mantén paridad entre desarrollo, staging y producción mediante overrides mínimos (`docker-compose.override.yml`).

## Validación
- Ejecuta `docker compose config` para revisar la configuración resultante.
- Comprueba con `docker compose ps` y `docker network inspect` que solo los puertos necesarios están publicados.
