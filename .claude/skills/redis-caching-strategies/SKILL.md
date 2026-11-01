---
name: redis-caching-strategies
description: Estrategias de caché con Redis (cache-aside, TTL, invalidación, evicción). Úsalo al decidir qué cachear, cuánto tiempo y cómo invalidar.
---

# Redis caching strategies

## Cuándo usar
- Al decidir qué datos merecen caché.
- Al diseñar la invalidación tras una escritura.

## Reglas
- Patrón cache-aside: leer caché, si falla leer la base de datos y guardar el resultado.
- TTL explícito en cada clave, ajustado a la frecuencia de cambio del dato.
- Invalida o actualiza la clave en la misma transacción que la escritura, o tras confirmarla.
- Configura `maxmemory` y una política de evicción (`allkeys-lru` o `volatile-ttl`) según el uso.
- Nunca cachees stock como fuente de verdad.

## Validación
- Verifica con `TTL` que las claves expiran y con `INFO memory` que el consumo se mantiene dentro del límite.
