---
name: session-store-management
description: Almacenamiento de sesiones distribuidas en Redis para varias instancias del backend. Úsalo al configurar sesiones, expiración o revocación.
---

# Session store management

## Cuándo usar
- Al configurar sesiones compartidas entre varias instancias.
- Al implementar cierre de sesión o revocación.

## Reglas
- Guarda las sesiones en Redis, no en memoria del proceso.
- Usa un TTL igual a la duración de la sesión y renuévalo solo en actividad real.
- Almacena solo un identificador de sesión y datos mínimos; nunca contraseñas ni tokens completos.
- La revocación elimina la clave en Redis de forma inmediata.
- Usa un prefijo de clave que identifique el entorno (`prod:session:`).

## Validación
- Inicia sesión en una instancia y confirma que la sesión es válida en otra.
- Cierra sesión y confirma que la clave se elimina.
