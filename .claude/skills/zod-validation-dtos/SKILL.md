---
name: zod-validation-dtos
description: Validación estricta de entradas con Zod para DTOs y parámetros de API. Úsalo al definir o modificar el contrato de entrada de un endpoint.
---

# Zod validation for DTOs

## Cuándo usar
- Al crear un endpoint o cambiar su contrato de entrada.
- Al revisar si una entrada llega sin validar al servicio.

## Reglas
- Define un esquema Zod por DTO y exporta el tipo con `z.infer`.
- Usa `.strict()` para rechazar campos no esperados.
- Valida tipos, rangos, longitudes y formatos (UUID, email, enums).
- Aplica la validación en un pipe o interceptor reutilizable, no en cada controlador.
- Un solo lugar define cada validación; no repitas el mismo esquema en varios archivos.

## Validación
- Envía una entrada con campos extra y otra con tipos incorrectos; ambas deben responder `400`.
