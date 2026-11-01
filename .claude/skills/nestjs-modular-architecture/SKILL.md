---
name: nestjs-modular-architecture
description: Arquitectura modular en NestJS (módulos, servicios, controladores, inyección de dependencias). Úsalo al ubicar código existente, decidir dónde añadir lógica o revisar imports entre módulos.
---

# NestJS modular architecture

## Cuándo usar
- Al decidir si una funcionalidad va en un módulo existente o en uno nuevo.
- Al revisar dependencias entre módulos o inyecciones de servicios.

## Reglas
- Extiende un `Service` existente con nuevos métodos antes de crear uno nuevo.
- Cada módulo exporta solo lo que otros módulos necesitan.
- Los controladores solo orquestan: validan la entrada y delegan en servicios.
- Evita dependencias circulares; si aparecen, extrae un módulo compartido.
- Lee `src/<modulo>/<modulo>.module.ts` antes de tocar un módulo.

## Validación
- Confirma que la aplicación arranca sin errores de inyección de dependencias.
- Revisa que no quedó lógica duplicada en controladores o en otros servicios.
