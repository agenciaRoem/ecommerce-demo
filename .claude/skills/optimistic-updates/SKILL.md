---
name: optimistic-updates
description: Actualizaciones optimistas con TanStack Query para respuesta inmediata en la interfaz con rollback en caso de error. Úsalo en mutaciones donde la latencia afecta la experiencia, como registrar movimientos de stock.
---

# Optimistic updates

## Cuándo usar
- En mutaciones frecuentes donde el usuario espera respuesta inmediata.
- Al registrar movimientos de stock desde terminales móviles.

## Reglas
- En `onMutate`, cancela las consultas afectadas y guarda el estado anterior.
- Aplica el cambio optimista sobre la caché.
- En `onError`, restaura el estado anterior.
- En `onSettled`, invalida la consulta para sincronizar con el servidor.
- No uses actualizaciones optimistas para operaciones críticas de dinero sin confirmación del servidor.

## Validación
- Simula un error de red y confirma que la interfaz vuelve al estado anterior.
