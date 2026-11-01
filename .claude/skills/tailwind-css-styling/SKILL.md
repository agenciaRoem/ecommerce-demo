---
name: tailwind-css-styling
description: Estilos con Tailwind CSS (utilidades, tokens de diseño, variantes responsivas y de tema). Úsalo al estilizar componentes o definir colores y espaciados del proyecto.
---

# Tailwind CSS styling

## Cuándo usar
- Al estilizar componentes nuevos o existentes.
- Al definir colores, espaciados o tipografía del proyecto.

## Reglas
- Usa las clases de utilidad y los tokens definidos en `tailwind.config`; no escribas valores arbitrarios repetidos.
- Extrae patrones repetidos a un componente o a una variante (`cva` o similar), no a copias de clases.
- Usa variantes responsivas en orden mobile-first (sin prefijo, luego `sm:`, `md:`, `lg:`).
- Usa variantes de estado (`hover:`, `focus-visible:`, `dark:`) en lugar de JavaScript para estilos.

## Validación
- Revisa el componente en ancho móvil y de escritorio.
