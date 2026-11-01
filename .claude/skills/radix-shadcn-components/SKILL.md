---
name: radix-shadcn-components
description: Uso de componentes accesibles de Radix UI y Shadcn/UI como base de la interfaz. Úsalo antes de crear un componente de UI nuevo como diálogos, menús, selectores o tooltips.
---

# Radix and Shadcn components

## Cuándo usar
- Antes de crear un componente de interfaz interactivo.
- Al añadir diálogos, menús, selectores o formularios accesibles.

## Reglas
- Revisa primero los componentes Shadcn/Radix ya instalados en el proyecto.
- Extiende un componente existente con props o variantes en lugar de crear uno nuevo.
- Mantén los componentes de Shadcn en `components/ui` sin modificar su lógica interna; personaliza con props y clases.
- Respeta el soporte de teclado y los atributos ARIA que Radix ya provee.

## Validación
- Navega el componente solo con teclado y confirma el foco visible.
