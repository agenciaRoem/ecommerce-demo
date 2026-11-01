---
name: frontend-security
description: Seguridad en el frontend (prevención de XSS, sanitización de entradas con Zod, manejo seguro de datos). Úsalo al mostrar contenido del usuario, procesar formularios o integrar datos externos.
---

# Frontend security

## Cuándo usar
- Al mostrar datos introducidos por usuarios.
- Al validar formularios o respuestas de la API.

## Reglas
- No uses `dangerouslySetInnerHTML` con contenido no confiable; si es imprescindible, sanitiza con DOMPurify.
- Valida formularios y respuestas de la API con esquemas Zod.
- Nunca guardes tokens o datos sensibles en `localStorage`.
- Evita construir URLs con datos del usuario sin codificarlos.
- No expongas claves secretas en variables `NEXT_PUBLIC_`.

## Validación
- Introduce `<script>` en un campo de texto y confirma que no se ejecuta ni se renderiza como HTML.
