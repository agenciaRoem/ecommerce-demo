---
name: rbac-context-authorization
description: Control de acceso basado en roles (RBAC) con contexto de sucursal (branch_id) para aislar datos entre sucursales. Úsalo al proteger endpoints, asignar roles o filtrar datos por sucursal.
---

# RBAC with branch context

## Cuándo usar
- Al crear un endpoint que accede a datos de una sucursal.
- Al revisar si un usuario puede ver o modificar datos de otra sucursal.

## Reglas
- Cada petición autenticada debe resolver el rol del usuario y su `branch_id` en el servidor.
- Todas las consultas de datos operativos filtran por `branch_id` obtenido del contexto, nunca del body de la petición.
- Aplica los permisos mediante `Guards` reutilizables con decoradores de roles.
- Un rol con alcance global debe declararse de forma explícita, no por omisión.
- Registra los accesos denegados sin exponer datos de otras sucursales en el mensaje de error.

## Validación
- Prueba con dos usuarios de sucursales distintas que cada uno solo ve sus datos.
- Confirma que un `branch_id` manipulado en el body es ignorado.
