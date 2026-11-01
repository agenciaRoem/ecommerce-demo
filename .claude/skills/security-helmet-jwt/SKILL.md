---
name: security-helmet-jwt
description: Seguridad del backend NestJS con Helmet para cabeceras HTTP y JWT para autenticación. Úsalo al configurar autenticación o cabeceras de seguridad en la aplicación.
---

# Security with Helmet and JWT

## Cuándo usar
- Al configurar el arranque de la aplicación NestJS.
- Al implementar o revisar login, validación de tokens y guards de autenticación.

## Reglas
- Activa Helmet en `main.ts` con la configuración por defecto.
- Valida el JWT en un guard reutilizable que verifique firma, `exp` y `iss`.
- Guarda el token en cookies HttpOnly (ver `jwt-http-only-cookies` en el agente de devops).
- No incluyas datos sensibles en el payload del token.
- Los secretos JWT vienen de variables de entorno y nunca se escriben en el código.

## Validación
- Confirma que un token alterado o expirado responde `401`.
- Verifica las cabeceras de seguridad con `curl -I`.
