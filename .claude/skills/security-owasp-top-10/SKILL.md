---
name: security-owasp-top-10
description: Mitigación defensiva de los riesgos del OWASP Top 10 en aplicaciones web. Úsalo al auditar o diseñar controles contra inyecciones, control de acceso roto, fallos criptográficos, configuraciones inseguras y componentes vulnerables.
---

# OWASP Top 10 mitigation

## Cuándo usar
- Al revisar la seguridad de una aplicación web o de su API.
- Al añadir endpoints, formularios o integraciones externas.

## Controles clave
- **Control de acceso roto**: verifica permisos en el servidor en cada endpoint, nunca solo en el cliente.
- **Fallos criptográficos**: TLS obligatorio, contraseñas con bcrypt o argon2, sin datos sensibles en claro.
- **Inyección**: consultas parametrizadas (ORM o prepared statements), validación de entrada.
- **Diseño inseguro**: límites de tasa, flujos con mínimo privilegio.
- **Configuración incorrecta**: cabeceras de seguridad, modo debug desactivado en producción.
- **Componentes vulnerables**: `npm audit` o equivalente en el pipeline, dependencias actualizadas.
- **Fallos de autenticación**: bloqueo o retardo tras intentos fallidos, expiración de sesiones.
- **Fallos de integridad**: verificación de paquetes y de artefactos de CI/CD.
- **Registro y monitoreo**: registrar eventos de seguridad sin guardar secretos en los logs.
- **SSRF y XSS**: validar URLs salientes y sanitizar salidas.

## Validación
- Revisa cada control contra el código existente antes de declararlo cubierto.
