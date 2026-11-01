---
name: error-handling
description: Manejo centralizado de errores en NestJS con excepciones HTTP tipadas y respuestas sin datos sensibles. Úsalo al lanzar errores en servicios o al definir cómo responde la API ante fallos.
---

# Error handling

## Cuándo usar
- Al lanzar errores desde servicios o repositorios.
- Al revisar qué información llega al cliente cuando algo falla.

## Reglas
- Usa las excepciones HTTP de NestJS (`NotFoundException`, `ConflictException`, etc.) en lugar de `throw new Error`.
- Centraliza la conversión de errores en un filtro de excepciones global.
- Nunca expongas stack traces, consultas SQL ni nombres internos en la respuesta.
- Registra el error completo en el servidor con un identificador de correlación.
- Mapea errores de Prisma (por ejemplo `P2002` de unicidad) a códigos HTTP apropiados.

## Validación
- Provoca un error de base de datos y confirma que la respuesta no contiene detalles internos.
