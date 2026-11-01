---
name: pwa-camera-integration
description: Progressive Web App con manifest y service worker, y acceso a la cámara desde el navegador para escanear o fotografiar. Úsalo al configurar la PWA o al integrar captura de imagen o códigos.
---

# PWA and camera integration

## Cuándo usar
- Al configurar `manifest` y service worker.
- Al integrar la cámara para fotos o escaneo de códigos.

## Reglas
- La cámara solo funciona sobre HTTPS (o localhost); verifica el entorno antes de probar.
- Pide permiso de cámara solo cuando el usuario inicia la acción.
- Libera el stream de la cámara (`track.stop()`) al desmontar el componente.
- El service worker cachea solo recursos estáticos; nunca cachees respuestas de la API con datos de stock.
- Valida que el manifest incluye iconos y `start_url`.

## Validación
- Abre la app en un móvil, concede permiso de cámara y confirma que el stream se detiene al salir de la vista.
