---
name: typescript-enterprise
description: Tipado estricto en TypeScript para proyectos empresariales (strict mode, tipos de dominio, evitar any). Úsalo al escribir o revisar código TypeScript en el backend.
---

# TypeScript enterprise

## Cuándo usar
- Al escribir nuevos servicios, DTOs o utilidades en TypeScript.
- Al revisar código con tipos débiles o inseguros.

## Reglas
- Mantén `"strict": true` en `tsconfig.json`.
- No uses `any`; usa `unknown` y estrechamiento de tipos cuando el tipo no sea conocido.
- Define tipos de dominio explícitos y reutilízalos (no repitas la misma forma en varios archivos).
- Tipa los valores de retorno de funciones públicas de servicios.
- Usa tipos derivados de los esquemas Zod o de Prisma en lugar de duplicarlos a mano.

## Validación
- Ejecuta `tsc --noEmit` sin errores.
- Busca `any` nuevos en el diff antes de confirmar el cambio.
