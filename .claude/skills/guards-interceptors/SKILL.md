---
name: guards-interceptors
description: Guards, Pipes e Interceptors reutilizables en NestJS para autorización, validación y transformación transversal. Úsalo al añadir lógica que aplica a varios endpoints.
---

# Guards and interceptors

## Cuándo usar
- Al proteger rutas con autenticación o permisos.
- Al añadir logging, transformación de respuestas o manejo transversal.

## Reglas
- Reutiliza los Guards, Pipes e Interceptors existentes antes de crear uno nuevo.
- Los Guards solo deciden acceso (true/false o excepción); no modifican datos.
- Los Interceptors envuelven la ejecución para logging, timeouts o transformación de respuesta.
- Aplica los Guards globalmente cuando la regla sea general y por decorador cuando sea específica.

## Validación
- Confirma que una ruta protegida devuelve `401` sin token y `403` sin rol suficiente.
