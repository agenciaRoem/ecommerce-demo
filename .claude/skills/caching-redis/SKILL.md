---
name: caching-redis
description: Caché con Redis en el backend NestJS (claves, TTL, invalidación) sin afectar la consistencia del stock. Úsalo al añadir o modificar caché de lecturas en los servicios.
---

# Redis caching in the backend

## Cuándo usar
- Al cachear respuestas de consultas frecuentes y poco cambiantes.
- Al decidir cuándo invalidar una entrada.

## Reglas
- Cachea solo lecturas; nunca uses caché como fuente de verdad para el stock.
- Define un TTL explícito en cada clave.
- Usa claves con namespace y sucursal (`branch:{id}:products`) para evitar mezclar datos entre sucursales.
- Invalida la caché dentro del mismo flujo que modifica los datos.
- Reutiliza el servicio de caché existente antes de crear uno nuevo.

## Validación
- Confirma que tras una escritura la siguiente lectura no devuelve datos antiguos.
- Verifica con `TTL` en Redis que las claves expiran.
