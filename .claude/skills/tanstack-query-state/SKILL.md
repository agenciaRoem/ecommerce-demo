---
name: tanstack-query-state
description: Gestión del estado del servidor con TanStack Query (queries, mutations, claves, invalidación). Úsalo al obtener o modificar datos del backend desde el frontend.
---

# TanStack Query state

## Cuándo usar
- Al obtener datos de la API desde un componente.
- Al enviar cambios que deben refrescar otra vista.

## Reglas
- Usa `useQuery` para lecturas y `useMutation` para escrituras.
- Define claves de consulta consistentes y centralizadas (`['branch', branchId, 'products']`).
- Invalida las consultas afectadas tras una mutación en `onSuccess`.
- Reutiliza los hooks de consulta existentes antes de crear uno nuevo.
- Maneja los estados `isLoading` y `isError` en la interfaz.

## Validación
- Confirma que tras una mutación la vista muestra datos actualizados sin recargar la página.
