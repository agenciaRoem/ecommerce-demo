---
name: cloudflare-waf-dns
description: Configuración de DNS, proxy, WAF y protección DDoS en Cloudflare para exponer servicios de forma segura. Úsalo al configurar registros DNS, reglas del WAF o el modo de cifrado de un dominio.
---

# Cloudflare WAF and DNS

## Cuándo usar
- Al apuntar un dominio o subdominio a un servidor.
- Al definir reglas de WAF, rate limiting o protección DDoS.

## Reglas
- Activa el proxy (nube naranja) en los registros que deben ocultar la IP de origen.
- Configura SSL/TLS en modo **Full (strict)** con certificado válido en el origen.
- Restringe el firewall del servidor para aceptar tráfico HTTP solo desde las IP de Cloudflare.
- Activa las reglas gestionadas del WAF y el modo DDoS por defecto.
- Añade reglas de rate limiting sobre endpoints de autenticación.
- Activa HSTS solo cuando HTTPS esté verificado en todos los subdominios.

## Validación
- Comprueba con `dig` que los registros apuntan a Cloudflare y no a la IP de origen.
- Verifica que una petición directa a la IP de origen es rechazada.
