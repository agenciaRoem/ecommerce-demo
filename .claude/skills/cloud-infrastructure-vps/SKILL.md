---
name: cloud-infrastructure-vps
description: Configuración segura de servidores VPS y entornos cloud (acceso SSH, firewall, usuarios, actualizaciones, despliegue de contenedores). Úsalo al preparar o endurecer un VPS o un despliegue en la nube.
---

# Cloud infrastructure on VPS

## Cuándo usar
- Al provisionar o endurecer un VPS.
- Al desplegar contenedores en un servidor propio o en un proveedor cloud.

## Reglas
- Deshabilita el login SSH con contraseña y el login de root; usa claves SSH.
- Activa un firewall (UFW o equivalente) que solo permita los puertos necesarios (22 restringido, 80, 443).
- Crea un usuario de despliegue sin privilegios de root y con acceso a Docker solo si es necesario.
- Mantén el sistema actualizado con actualizaciones de seguridad automáticas.
- Separa datos persistentes (volúmenes, backups) del código desplegado.
- Configura copias de seguridad automáticas y prueba la restauración.

## Validación
- Verifica que los puertos abiertos coincidan con los documentados (`ss -tulpn`).
- Confirma que el acceso SSH por contraseña está deshabilitado (`sshd -T`).
