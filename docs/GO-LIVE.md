# Puesta en marcha: qué hacer cuando se venda

El sistema está construido de punta a punta y probado con datos de demostración y un simulador de Mercado Pago.
Esta lista reúne lo que **no se pudo probar sin una cuenta real** o que depende del negocio que lo use.
Ordenada para hacerla de arriba hacia abajo.

## 1. Datos del negocio (sin código)
- [ ] **Nombre, teléfono, email, horarios y banners** de la tienda: `frontend/src/lib/site.ts`. Colores: variables `--brand*` al final de `frontend/src/app/globals.css`. Logo: `frontend/src/components/store/logo.tsx`.
- [ ] **Sucursales reales** (nombre, dirección, teléfono): hoy son 3 de ejemplo (`prisma/seed.ts`). Se editan desde `/admin/sucursales`.
- [ ] **Categorías, productos, precios, imágenes y stock reales.** Los empleados de depósito cargan productos y stock desde `/stockeo`; los gerentes ajustan precios y costos en `/admin/precios`.
- [ ] **Quitar los datos de demostración:** no volver a correr el seed con `SEED_DEMO_CATALOG` ni `SEED_DEMO_STAFF_PASSWORD`, y desactivar los productos `DEMO-*`.
- [ ] **Cuentas del personal reales** (gerentes, sala, stockeo, encargados de stock) y **cambiar la contraseña del SUPERADMIN**. El alta se hace en `/admin/personal`; desactivá las cuentas demo `@omnistock.local`.

## 2. Servidor y seguridad
- [ ] VPS con Docker, **dominio y HTTPS** (Cloudflare delante): seguir [`docs/DEPLOY.md`](DEPLOY.md) de arriba abajo.
- [ ] En el `.env` de producción: `NODE_ENV=production`, `COOKIE_SECURE=true`, `CORS_ORIGINS=https://tu-dominio`, `PUBLIC_API_URL=https://api.tu-dominio`, `PUBLIC_STORE_URL=https://tu-dominio`, `COOKIE_DOMAIN` si tienda y API están en subdominios.
- [ ] **Secretos nuevos y largos** para la base, Redis, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` y `SETTINGS_ENCRYPTION_KEY`. No reutilizar los de desarrollo.
- [ ] **Guardar `SETTINGS_ENCRYPTION_KEY` en un gestor de contraseñas.** Si se pierde, las credenciales de Mercado Pago guardadas no se pueden recuperar y hay que volver a cargarlas.
- [ ] **Copias de seguridad** programadas (`deploy/backup.sh` en cron), **sincronizadas fuera del servidor**, y una **prueba de restauración** hecha al menos una vez.
- [ ] Un monitor externo sobre `/health` y la portada (UptimeRobot o similar).
- [ ] Regla de Cloudflare que omita el WAF para `/payments/webhooks/*` (si no, Mercado Pago no puede avisar los pagos).

## 3. Mercado Pago (probar antes de cobrar de verdad)
1. [ ] Crear la **aplicación** en [Tus integraciones](https://www.mercadopago.com.ar/developers/panel/app) (Checkout Pro).
2. [ ] En `/admin/pagos`: cargar las **credenciales de PRUEBA**, modo *Pruebas*, y pegar la **URL del webhook** en Mercado Pago (necesita la `PUBLIC_API_URL` pública con HTTPS). Cargar la clave secreta que genera.
3. [ ] Probar con **usuarios de prueba** de Mercado Pago (vendedor y comprador), y recorrer:
   - [ ] Pago aprobado → el pedido pasa a *Pagado*, baja el stock y aparece en el panel de sala.
   - [ ] Pago rechazado → el cliente puede reintentar.
   - [ ] Abandonar el pago → a los 30 minutos se libera el stock.
   - [ ] «Simular notificación» desde el panel de Mercado Pago → aparece en *Últimos avisos recibidos*.
4. [ ] Pasar a **credenciales de PRODUCCIÓN**, modo *Producción*, y hacer **una compra real de importe bajo** de punta a punta (y reembolsarla desde Mercado Pago).
- Si algo cambió en la API de Mercado Pago, los ajustes están concentrados en `backend/src/payments/gateways/mercadopago.gateway.ts` y `mercadopago-signature.ts`.
- **Reembolsos:** hoy se hacen a mano desde el panel de Mercado Pago. Un pago tardío sin stock queda marcado en el pedido (`payment_issue`) y en `audit_logs`.

## 3 bis. Verificación de CUIT de comercios (B2B)
- El registro **valida el formato y el dígito verificador**, pero **no consulta a ARCA**. Un comercio nuevo compra a precio minorista hasta que alguien lo apruebe.
- **Procedimiento:** revisar el CUIT contra la constancia de ARCA y aprobarlo en `/admin/comercios` (pide con qué se comprobó y queda auditado).
  El cliente ve los precios mayoristas al renovar su sesión (hasta 15 minutos) o al volver a ingresar.
- El **costo del envío** a domicilio hoy es «a coordinar» (no se suma al total).

## 3 ter. Correo y cuentas
- [ ] **Proveedor de correo (SMTP)** configurado (`MAIL_*`, `SMTP_*`) y dominio del remitente verificado con **SPF y DKIM**. Sin esto, la verificación de email y la recuperación de contraseña no funcionan, y el backend no arranca en producción.
- [ ] Probar con un email real: registro → correo de verificación → compra; y "Olvidé mi contraseña" → correo → contraseña nueva.
- [ ] (Opcional) **Ingreso con Google**: crear el cliente OAuth y cargar `GOOGLE_CLIENT_ID/SECRET` (ver `docs/DEPLOY.md`). Publicar la pantalla de consentimiento.
- [ ] Definir `COOKIE_DOMAIN` si la tienda y la API están en subdominios distintos.

## 4. Lo que todavía no existe (decidir si hace falta)
- [ ] **Avisos al cliente** por email/WhatsApp (pedido listo, etc.): hoy el cliente ve el estado en su pantalla de pedido.
- [ ] **Reembolso automático** por la API de Mercado Pago.
- [ ] Los **reembolsos** se hacen en Mercado Pago y se asientan en `/admin/incidencias`.
- [ ] **Segundo factor** para el personal (al menos superadmin y gerentes): ver `docs/SECURITY.md`.
- [ ] **Fotos en almacenamiento de objetos** (S3/R2) antes de usar más de un servidor.
