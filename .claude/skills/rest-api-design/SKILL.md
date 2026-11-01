---
name: rest-api-design
description: Diseño de APIs RESTful (recursos, verbos HTTP, códigos de estado, paginación, versionado). Úsalo al diseñar o modificar rutas y contratos de una API.
---

# REST API design

## Cuándo usar
- Al crear nuevas rutas o cambiar las existentes.
- Al definir respuestas, errores o paginación.

## Reglas
- Usa sustantivos en plural para los recursos (`/branches/:id/products`).
- Verbos HTTP con significado: `GET` lectura, `POST` creación, `PATCH` actualización parcial, `DELETE` borrado.
- Códigos de estado correctos: `201` al crear, `204` sin contenido, `404` si no existe, `409` en conflictos.
- Pagina las listas con `limit` y `cursor` u `offset` con límite máximo.
- Mantén un formato de respuesta y de error consistente en toda la API.
- Versiona la API (`/v1`) cuando un cambio rompa a los clientes.

## Validación
- Revisa que cada ruta nueva sigue el patrón de las existentes.
