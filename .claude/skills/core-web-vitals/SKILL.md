---
name: core-web-vitals
description: Métricas Core Web Vitals (LCP, INP, CLS) y cómo mejorarlas en la aplicación. Úsalo al diagnosticar lentitud percibida o inestabilidad visual en una página.
---

# Core Web Vitals

## Cuándo usar
- Al revisar el rendimiento percibido de una página.
- Al diagnosticar saltos de diseño o respuesta lenta a la interacción.

## Reglas
- **LCP** (carga del contenido principal): optimiza la imagen principal y reduce el JavaScript bloqueante.
- **INP** (respuesta a interacciones): evita tareas largas en el hilo principal.
- **CLS** (estabilidad visual): reserva espacio para imágenes, fuentes y contenido asíncrono.
- Mide con datos reales (Lighthouse y Web Vitals) antes de optimizar.

## Validación
- Confirma que LCP ≤ 2.5 s, INP ≤ 200 ms y CLS ≤ 0.1 en la vista revisada.
