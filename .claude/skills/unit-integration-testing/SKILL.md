---
name: unit-integration-testing
description: Pruebas unitarias y de integración en NestJS con Jest y base de datos de prueba. Úsalo al añadir o revisar tests de servicios, controladores y flujos de RBAC o transacciones.
---

# Unit and integration testing

## Cuándo usar
- Después de cambiar un servicio, un guard o una transacción.
- Al verificar un flujo completo de endpoint.

## Reglas
- Pruebas unitarias para la lógica de servicios, con dependencias mockeadas.
- Pruebas de integración para endpoints, guards y consultas reales a una base de datos de prueba.
- Cada prueba de RBAC verifica un caso permitido y uno denegado por sucursal.
- Las pruebas de transacciones deben forzar un fallo y comprobar el rollback.
- No compartas estado entre pruebas; resetea la base de datos de prueba.

## Validación
- Ejecuta la suite completa (`npm run test` y `npm run test:e2e`) antes de declarar el cambio terminado.
