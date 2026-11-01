# Despliegue en un VPS

Guía para poner OmniStock en internet: servidor, dominio, HTTPS, despliegue automático, respaldos y qué hacer si algo sale mal.
Pensada para **un VPS con Docker detrás de Cloudflare**. Los archivos que usa están en `deploy/`, `docker-compose.prod.yml` y `.github/workflows/`.

```
Internet ─► Cloudflare (WAF, DDoS) ─► Caddy :443 (HTTPS, IP real) ─┬─► frontend (Next.js)   tienda.com.ar
                                                                   └─► backend  (NestJS)    api.tienda.com.ar
                                                                         │
                                                              red interna: Postgres · Redis
```

Solo Caddy escucha en internet. Backend, frontend, Postgres y Redis no publican puertos: viven en una red interna de Docker.

## 1. Qué necesitás
- Un VPS Linux (Ubuntu LTS), **2 vCPU / 2 GB** como mínimo para empezar.
- Un dominio con DNS en Cloudflare (plan gratuito alcanza).
- Un repositorio en GitHub con este código (el pipeline publica las imágenes en GHCR, gratis).

## 2. Preparar el servidor (una sola vez)
Entrar como administrador y hacer, en este orden:

1. **Usuario sin privilegios** para desplegar y acceso solo con clave:
   ```bash
   adduser deploy && usermod -aG docker deploy      # después de instalar Docker (paso 3)
   # copiar tu clave pública a /home/deploy/.ssh/authorized_keys
   ```
   En `/etc/ssh/sshd_config`: `PermitRootLogin no`, `PasswordAuthentication no`. Reiniciar `sshd` **sin cerrar la sesión actual** y probar el ingreso desde otra terminal antes de salir.
2. **Cortafuegos**: solo SSH, HTTP y HTTPS.
   ```bash
   ufw default deny incoming && ufw default allow outgoing
   ufw limit 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp
   ufw enable
   ```
   (Docker salta `ufw` para los puertos que publica; por eso la pila publica **solo** Caddy.)
3. **Parches automáticos y protección contra fuerza bruta de SSH**: `apt install unattended-upgrades fail2ban`.
4. **Hora correcta**: `timedatectl set-ntp true`.

## 3. Instalar Docker
Seguir la guía oficial para Ubuntu (`docs.docker.com/engine/install/ubuntu`) e instalar también el plugin `docker compose`.

## 4. Dominio y Cloudflare
1. Registros DNS **con proxy (nube naranja)** hacia la IP del VPS: `tienda.com.ar` y `api.tienda.com.ar` (tipo A).
2. **SSL/TLS → modo "Full (strict)"** y activar "Always Use HTTPS". Caddy obtiene su certificado solo (Let's Encrypt).
3. **WAF**: activar las reglas administradas y "Bot Fight Mode".
4. ⚠️ **Mercado Pago**: crear una regla que *omita* el WAF y el Bot Fight para la ruta `api.tienda.com.ar/payments/webhooks/*`. Si Cloudflare bloquea al servidor de Mercado Pago, los pagos no se confirman. El webhook igual se autentica con su firma.
5. **Cache**: respetar los encabezados del origen (las fotos de `/media` son inmutables y se pueden cachear; la API no).
6. Opcional pero recomendable: en el cortafuegos del VPS, aceptar 80/443 **solo desde las IP de Cloudflare** (`cloudflare.com/ips`).

> La IP real del cliente la resuelve Caddy (`deploy/Caddyfile`): solo confía en los encabezados que llegan desde Cloudflare, por lo que nadie puede falsear su IP para esquivar el límite de intentos ni ensuciar la auditoría. La lista de rangos está en el Caddyfile; conviene revisarla de vez en cuando.

## 5. Primer despliegue
En el servidor, como `deploy`:
```bash
sudo mkdir -p /opt/omnistock && sudo chown deploy: /opt/omnistock && cd /opt/omnistock
git clone <url-del-repo> .                      # o copiar solo deploy/, docker-compose*.yml y .env.production.example
cp .env.production.example .env && chmod 600 .env
```
Completar `.env` (cada variable está explicada en la plantilla). Generar los secretos con `openssl rand -base64 48` (y `-base64 32` para `SETTINGS_ENCRYPTION_KEY`).

- **`SETTINGS_ENCRYPTION_KEY`: guardar una copia en un gestor de contraseñas.** Si se pierde, las credenciales de Mercado Pago guardadas no se pueden recuperar.
- El backend **se niega a arrancar** en producción si las URLs no son `https`, si las cookies no son `Secure`, si un secreto parece de ejemplo o si el correo no está configurado (`MAIL_DRIVER=smtp`).

Iniciar sesión en el registro de imágenes (una vez; token de GitHub con permiso `read:packages`):
```bash
echo <TOKEN> | docker login ghcr.io -u <usuario-github> --password-stdin
```
Publicar la primera versión desde GitHub (sección 6) o, para probar a mano con imágenes ya publicadas:
```bash
./deploy/deploy.sh v1.0.0
```
Crear el primer superadmin (usa `SEED_SUPERADMIN_EMAIL/PASSWORD` del `.env`):
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile tools run --rm migrate npx prisma db seed
```
Entrar a `https://tienda.com.ar/login`, **cambiar la contraseña**, y recién ahí borrar `SEED_SUPERADMIN_PASSWORD` del `.env`.

### Correo saliente (obligatorio)
Sin correo nadie puede confirmar su email ni recuperar su contraseña. Elegir un proveedor SMTP (Brevo, Mailgun, Amazon SES… tienen planes gratuitos o muy baratos para este volumen) y completar `MAIL_FROM` y `SMTP_*` en el `.env`.
- Verificar el **dominio del remitente** en el proveedor y publicar los registros **SPF y DKIM** en Cloudflare (DNS **sin proxy**, nube gris). Sin eso, los correos caen en spam.
- Probar: crear una cuenta de cliente con un email propio, y confirmar que llega el correo de verificación y el de "Olvidé mi contraseña".

### Ingreso con Google (opcional)
En `console.cloud.google.com` → *APIs y servicios* → *Credenciales* → *ID de cliente de OAuth* (aplicación web):
- Orígenes autorizados: `https://tienda.com.ar`
- URI de redirección autorizada: `https://api.tienda.com.ar/customers/auth/google/callback`
- Pantalla de consentimiento: nombre del negocio, correo de soporte y dominio autorizado; publicarla (si queda en "prueba", solo entran los usuarios de prueba).
- Copiar el ID y el secreto a `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` del `.env`. Es importante definir `COOKIE_DOMAIN=tienda.com.ar` para que la sesión sirva en la tienda y en la API.

## 6. Despliegue automático (GitHub Actions)
En el repositorio, **Settings**:

| Dónde | Nombre | Valor |
|---|---|---|
| Variables | `PUBLIC_API_URL` | `https://api.tienda.com.ar` (se incrusta al compilar la tienda) |
| Secrets | `DEPLOY_HOST` | IP o nombre del VPS |
| Secrets | `DEPLOY_USER` | `deploy` |
| Secrets | `DEPLOY_SSH_KEY` | clave privada **solo para despliegues** (`ssh-keygen -t ed25519`; la pública va a `authorized_keys`) |
| Secrets | `DEPLOY_KNOWN_HOSTS` | salida de `ssh-keyscan -p 22 <host>` (evita ataques de intermediario) |
| Secrets (opcional) | `DEPLOY_PORT`, `DEPLOY_PATH` | si no son `22` y `/opt/omnistock` |
| Environments | `production` | agregar **revisores obligatorios**: nadie despliega sin una aprobación |

Para publicar una versión:
```bash
git tag v1.0.1 && git push --tags
```
El pipeline (`deploy.yml`) compila y publica las tres imágenes en GHCR, espera la aprobación del entorno `production` y ejecuta `deploy/deploy.sh` en el servidor, que:
1. hace un **respaldo** previo;
2. baja las imágenes nuevas;
3. aplica las **migraciones** de la base;
4. levanta los servicios;
5. comprueba `https://api.<dominio>/health` y, **si no responde, vuelve solo a la versión anterior**.

Cada cambio al código pasa antes por `ci.yml` (lint, tipos, pruebas unitarias, de integración y de pantallas, auditoría de dependencias, escaneo de imágenes y de secretos). Conviene proteger la rama `main` exigiendo que esas verificaciones pasen.

> Las migraciones aplicadas **no se deshacen** al volver a una versión anterior. Por eso las migraciones del proyecto son aditivas y se escriben para convivir con la versión previa durante el despliegue.

## 7. Respaldos
`deploy/backup.sh` guarda la base (`pg_dump`) y las fotos de productos, verifica que las copias no estén vacías ni dañadas y borra las de más de 14 días.
```bash
crontab -e
0 3 * * *  cd /opt/omnistock && ./deploy/backup.sh >> /var/log/omnistock-backup.log 2>&1
```
**Una copia que queda en el mismo servidor no es una copia.** Sincronizar `backups/` a otro lugar (otro VPS, un bucket S3/R2 con `rclone sync`…).

Restaurar (destruye lo actual y pide confirmación escrita):
```bash
./deploy/restore.sh backups/db-AAAAMMDD-HHMMSS.dump backups/media-AAAAMMDD-HHMMSS.tar.gz
```
**Probar la restauración** en un servidor de pruebas al menos una vez antes de abrir la tienda, y repetirlo cada tanto: un respaldo que nunca se restauró es una suposición.

## 8. Vigilancia
- Un monitor externo (UptimeRobot, Better Stack) sobre `https://api.tienda.com.ar/health` y la portada, con aviso por email/WhatsApp.
- Logs: `docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend` (rotan solos, 5 × 10 MB por servicio).
- Espacio en disco: `docker system df` y `df -h`. Las imágenes viejas se limpian en cada despliegue.
- En el backoffice, **Pagos a revisar** (insignia roja) y **Auditoría** muestran lo que requiere una persona.

## 9. Rotar secretos
| Secreto | Efecto al cambiarlo |
|---|---|
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Cierra todas las sesiones (personal y clientes). Hacerlo ante cualquier sospecha de filtración. |
| `POSTGRES_PASSWORD` / `REDIS_PASSWORD` | Cambiar en el servicio **y** en el `.env`, y reiniciar la pila. |
| `SETTINGS_ENCRYPTION_KEY` | Invalida las credenciales de Mercado Pago guardadas: volver a cargarlas en `/admin/pagos`. |
| Credenciales de Mercado Pago | Desde `/admin/pagos`, sin tocar código. |

## 10. Crecer
- La API ya admite **varias instancias**: sesiones, límite de intentos y reservas viven en Redis/Postgres, no en memoria.
- Las fotos están en el disco del servidor (`STORAGE_DRIVER=local`). **Antes de poner más de una instancia** (o de moverse a otro servidor) hay que pasarlas a un almacenamiento de objetos (S3/R2/MinIO): el código está preparado con un adaptador por proveedor (`backend/src/storage`).
- Postgres y Redis son de una sola instancia. Para alta disponibilidad, usar un Postgres administrado y Redis con réplica.
