---
name: network-hardening
description: Endurecimiento de la red de servicios: aislamiento de base de datos y caché, exposición mínima de puertos y segmentación entre contenedores. Úsalo al revisar la topología de red o los puertos publicados.
---

# Network hardening

## Cuándo usar
- Al revisar qué puertos están expuestos hacia el exterior.
- Al definir qué servicios pueden comunicarse entre sí.

## Reglas
- Publica al host solo el puerto del proxy o gateway; el resto de servicios queda en red interna.
- La base de datos y Redis nunca se exponen públicamente; exige autenticación y TLS si se accede por red.
- Segmenta redes: frontend, backend y datos en redes separadas.
- Cierra puertos de administración (SSH, paneles) o restringe su acceso por IP.
- Desactiva servicios y puertos que no se usan.
- Aplica reglas de firewall por defecto denegar (default deny).

## Validación
- Escanea los puertos abiertos desde fuera del servidor y compara con la lista permitida.
- Comprueba desde un contenedor de frontend que no puede alcanzar directamente la base de datos.
