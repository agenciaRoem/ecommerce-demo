---
name: jwt-http-only-cookies
description: Manejo de tokens JWT almacenados en cookies HttpOnly, Secure y SameSite, con rotación y expiración. Úsalo al implementar o revisar autenticación basada en JWT.
---

# JWT in HttpOnly cookies

## Cuándo usar
- Al implementar login, refresh o logout con JWT.
- Al revisar por qué una sesión expira o no se valida correctamente.

## Reglas
- Guarda el JWT en una cookie `HttpOnly`, `Secure` y con `SameSite=Strict` o `Lax`, nunca en `localStorage`.
- Usa access tokens de vida corta y refresh tokens rotados.
- Firma con algoritmos fuertes (HS256 con secreto largo o RS256) y valida siempre `exp`, `iss` y `aud`.
- Carga los secretos desde variables de entorno o un secrets manager.
- En logout, borra la cookie con los mismos atributos con los que se creó.
- Protege contra CSRF cuando la cookie se envía automáticamente (token CSRF o `SameSite`).

## Validación
- Comprueba que las cabeceras `Set-Cookie` incluyen `HttpOnly; Secure; SameSite`.
- Verifica que un token expirado o manipulado es rechazado.
