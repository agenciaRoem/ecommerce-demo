---
name: helmet-cors-rate-limiting
description: Cabeceras de seguridad con Helmet, política CORS restrictiva y límites de tasa (rate limiting) en APIs. Úsalo al configurar un servidor Express o NestJS o al revisar su exposición a abuso.
---

# Helmet, CORS and rate limiting

## Cuándo usar
- Al inicializar la aplicación HTTP del backend.
- Al cambiar orígenes permitidos o límites de peticiones.

## Reglas
- Activa Helmet con sus valores por defecto y solo relaja una cabecera con justificación técnica.
- CORS: lista blanca explícita de orígenes; nunca `*` cuando hay cookies o credenciales.
- Habilita `credentials: true` solo para orígenes concretos.
- Aplica rate limiting global y más estricto en login, registro y recuperación de contraseña.
- Usa almacenamiento compartido (Redis) para el rate limiting si hay varias instancias.
- Limita el tamaño del body (`express.json({ limit })`).

## Validación
- Verifica las cabeceras de respuesta con `curl -I`.
- Confirma que un origen no permitido recibe rechazo CORS y que las peticiones excesivas devuelven `429`.
