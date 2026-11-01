---
name: cloudinary-aws-s3-media
description: Gestión segura de archivos multimedia con Cloudinary o AWS S3 (subidas firmadas, buckets privados, transformaciones). Úsalo al implementar subida, almacenamiento o entrega de imágenes y archivos.
---

# Cloudinary and AWS S3 media

## Cuándo usar
- Al implementar subida o descarga de imágenes y archivos.
- Al configurar buckets o cuentas de Cloudinary.

## Reglas
- Usa subidas firmadas o presigned URLs generadas por el backend; el cliente nunca recibe las credenciales.
- Mantén los buckets S3 privados por defecto y entrega los archivos con URLs firmadas o CloudFront.
- Valida en el backend tipo MIME, extensión y tamaño antes de aceptar un archivo.
- Usa nombres de archivo generados (UUID), nunca el nombre original del usuario.
- En Cloudinary, aplica transformaciones y límites desde la configuración, no en el cliente.
- Define políticas de ciclo de vida para eliminar archivos temporales.

## Validación
- Verifica que un objeto no es accesible sin firma.
- Prueba que un archivo con tipo o tamaño inválido es rechazado.
