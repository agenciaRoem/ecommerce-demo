# OmniStock Enterprise Core

E-commerce y motor de inventario multisucursal (B2C + B2B). Estado: **Fase 8** (pruebas, endurecimiento y despliegue) sobre el backoffice de gerencia y administración sobre operaciones de sucursal sobre carrito, checkout y pagos con Mercado Pago, catálogo público, cuentas de clientes y backoffice de pagos.

## Puesta en marcha
```bash
cp .env.example .env            # completar secretos
docker compose up -d --build postgres redis backend
docker compose --profile tools run --rm migrate                         # migraciones
docker compose --profile tools run --rm migrate npx prisma db seed      # datos semilla
curl http://localhost:4000/health
```
Desarrollo con Postgres/Redis en localhost: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up`.

## Autenticación (Fase 2)
- `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`. Los tokens viajan solo en cookies HttpOnly (`access_token` 15 min, `refresh_token` 7 días con rotación).
- Todo endpoint exige sesión salvo `@Public()`. Roles con `@Roles(...)` (SUPERADMIN siempre pasa). Aislamiento por sucursal con `@CurrentBranchScope()`: pasar su resultado directo al `where` de Prisma.
- Tests unitarios: `cd backend && npm test`.

## Inventario e imágenes (Fase 3)
- API: `GET /categories`, `GET /products`, `GET /products/lookup?code=`, `POST /products`, `GET /inventory`, `POST /inventory/receipts`, `POST /media/images`.
- Las imágenes se guardan detrás de `StorageProvider` (hoy disco local en un volumen, servido en `/media`); `sharp` genera variantes WebP (thumb/card/detail) y elimina el EXIF. Cambiar de proveedor = nuevo adaptador + `STORAGE_DRIVER`.
- Cada cambio de stock queda en `stock_movements` (tabla inmutable).
- Usuarios de ejemplo (solo desarrollo): definir `SEED_DEMO_STAFF_PASSWORD` y correr el seed (`gerente.cen@`, `sala.cen@`, `stockeo.cen@`, `stockeo.nor@omnistock.local`).

## Frontend (`/frontend`, Next.js)
```bash
cd frontend && cp .env.example .env.local && npm install
npm run dev            # http://localhost:3000  → /login → /stockeo (app móvil del stockeador)
```

## Tienda pública y clientes (Fase 4)
- API pública: `GET /catalog/{categories,branches,products,products/:id,products/:id/availability}`. Con sesión de cliente (`@OptionalCustomer()`), los precios se ajustan a su tipo de cuenta; el stock se lee siempre en el momento.
- Clientes: `POST /customers/register` (RETAIL o COMMERCE con CUIT validado por dígito verificador), `/customers/auth/{login,refresh,logout}`, `GET /customers/me`. Sesión propia (cookies `customer_*`), separada de la del personal; un token de una audiencia no sirve en la otra.
- Un comercio compra a precio minorista hasta que el personal verifica su CUIT (`customers.cuit_verified`); recién entonces ve la lista mayorista.
- Precios = lista (retail/wholesale según cliente) menos la mejor promoción vigente (`Promotion`: por porcentaje o monto, para todo / una categoría / productos, por público y sucursal).
- Identidad de la tienda (nombre, colores, banners, textos) en `frontend/src/lib/site.ts` y los tokens de `globals.css`.
- Catálogo de demostración (solo desarrollo): `SEED_DEMO_CATALOG=true` y `docker compose --profile tools run --rm migrate npx prisma db seed`.
- El build del frontend no necesita la API encendida (el contenido se pide en tiempo de ejecución, con esqueletos de carga).

## Conectar Mercado Pago (sin tocar código)
Todo se hace desde el backoffice del superadmin: **`/admin/pagos`** (ingresar en `/login` con la cuenta SUPERADMIN).
1. En [Mercado Pago Developers → Tus integraciones](https://www.mercadopago.com.ar/developers/panel/app), creá tu aplicación (Checkout Pro) y copiá el **Access Token** (y la **Public Key**).
2. En el panel: elegí el modo (Pruebas / Producción), pegá las credenciales y **Guardar y validar**. Se comprueban contra Mercado Pago antes de guardarse; si son inválidas no se guardan.
3. Copiá la **URL del webhook** que muestra el panel y pegala en Mercado Pago → tu aplicación → *Webhooks → Configurar notificaciones* (evento *Pagos*). Copiá la **clave secreta** que genera y pegala en el panel.
4. *Simular notificación* en Mercado Pago: el aviso debe aparecer en «Últimos avisos recibidos».
5. **Activar los cobros**. En producción pide una segunda confirmación.

Seguridad: las credenciales se guardan **cifradas** (AES-256-GCM) con `SETTINGS_ENCRYPTION_KEY` y nunca vuelven al navegador (solo los últimos 4 caracteres). Cada aviso se acepta solo con firma HMAC válida. Cada cambio queda en `audit_logs` (inmutable, sin secretos).
- **Guardá `SETTINGS_ENCRYPTION_KEY` en un lugar seguro** y no la cambies: si se pierde, hay que volver a cargar las credenciales.
- `PUBLIC_API_URL` debe ser la URL **pública y HTTPS** del backend en producción (es la que Mercado Pago llama); `PUBLIC_STORE_URL`, la de la tienda.
- Cambiar de Access Token desactiva los cobros: hay que reactivarlos a propósito.
- El checkout que usa esta configuración (carrito, pedido, redirección a Mercado Pago y conciliación del pago) está descripto en «Compra y pedidos (Fase 5)».

## Compra y pedidos (Fase 5)
Flujo: **carrito → checkout → pago en Mercado Pago → pedido**.
- **Carrito** (Redis, por cliente con sesión): `GET /cart`, `POST /cart/items`, `PATCH|DELETE /cart/items/:productId`, `GET /cart/count`. Guarda solo producto y cantidad; precios y stock se calculan al mirarlo. El carrito indica qué sucursales pueden entregar *todo* el pedido.
- **Reglas de entrega:** minorista (RETAIL) → solo **retiro en sucursal**; comercio (COMMERCE) → **retiro o envío a domicilio** (el costo del envío se coordina con la sucursal; hoy no se suma al total).
- **Checkout** (`POST /checkout`): en una única transacción recalcula precios en el servidor (nunca confía en el cliente), **reserva** el stock con un `UPDATE` condicional (todo o nada) y crea el pedido `PENDING_PAYMENT`; después crea el cobro en Mercado Pago. Si Mercado Pago falla, el pedido se cancela y la reserva se libera. Un solo pedido pendiente por cliente (el nuevo reemplaza al anterior).
- **Stock en tres pasos:** *reservar* al iniciar el pago → *confirmar* (baja el stock físico + movimiento `SALE`) al aprobarse → *liberar* si no se paga. Los pedidos sin pagar vencen a los `ORDER_PAYMENT_WINDOW_MINUTES` (30) y un proceso con candado en Redis libera su reserva (soporta varias instancias).
- **Conciliación:** el aviso (webhook) y la vuelta del cliente (`POST /orders/:id/sync`) **consultan el pago a Mercado Pago** y validan pedido e importe antes de cerrar el pedido; son idempotentes. Un pago que llega *después* del vencimiento recupera el pedido si todavía hay stock; si no, queda marcado para reembolsar (`orders.payment_issue` + auditoría).
- **Pedidos del cliente:** `GET /orders`, `GET /orders/:id`, `POST /orders/:id/cancel`. Pantallas: `/carrito`, `/checkout`, `/pedidos`, `/pedidos/:id`.
- Solo se ofrecen medios de pago que se acreditan al instante (se excluyen cupones y cajeros): un pago en efectivo tardaría más que la reserva.
- **Para probar sin dinero real:** conectá credenciales de *prueba* en `/admin/pagos` (modo Pruebas) y usá los usuarios de prueba de Mercado Pago. En tu PC, el webhook no llega (hace falta un túnel), pero al volver del pago el pedido se confirma igual por la verificación directa.

## Operaciones de sucursal (Fase 6)
Panel para el personal del local/depósito en **`/sala`** (roles SALA y GERENTE; el SUPERADMIN elige la sucursal). Entra directo al ingresar en `/login`.
- **Cola de pedidos** (`GET /branch/orders`, `/branch/orders/summary`): solo los pedidos **pagados de la sucursal del empleado**, del más antiguo al más nuevo; un pedido de otra sucursal responde 404. Se refresca sola cada 15 s, avisa cuando llega uno nuevo y destaca los que llevan demasiado esperando.
- **Estados** (`POST /branch/orders/:id/status`): *Pendiente → En preparación → Listo para retirar* (retiro) o *Listo para flete* (envío B2B) *→ Entregado*; se puede deshacer un paso. No se pueden saltear pasos ni mezclar retiro con flete, y dos empleados a la vez sobre el mismo pedido no se pisan (gana uno, el otro recibe un aviso).
- **Historial inmutable** de cada cambio (`order_status_events`): quién lo hizo y cuándo. El cliente ve su seguimiento en `/pedidos/:id`, sin saber qué empleado lo movió.
- **Ajuste de stock de emergencia** (`POST /inventory/adjustments`, pantalla `/sala/stock`): rotura, faltante, sobrante o devolución, con motivo obligatorio y registro por usuario. **Nunca deja el stock por debajo de lo reservado** para pedidos en curso, ni siquiera con ajustes simultáneos.
- El personal de sala **no ve costos ni datos de pago**: solo qué preparar, para quién y cómo contactarlo.
- Lo que falta para salir a vender está en [`docs/GO-LIVE.md`](docs/GO-LIVE.md).

## Backoffice (Fase 7)
Se entra por **`/admin`**. El **GERENTE** ve la gerencia de su sucursal; el **SUPERADMIN** ve además la administración. El menú y cada API respetan el rol.
- **Resumen** (`GET /backoffice/analytics/overview`): ventas, pedidos, ticket promedio, unidades, descuentos y margen estimado (con el costo actual) frente al período anterior; ventas por día, más vendidos, cola de sala, desglose por entrega, tipo de cliente y sucursal; stock bajo. El gerente ve su sucursal; el superadmin el total o la que elija. "Hoy" y el día de cada venta usan `BUSINESS_TIMEZONE`.
- **Precios y costos** (`/backoffice/prices`): edición por producto y **cambio masivo con vista previa** (aumento del proveedor, ajuste de precios, margen sobre costo; redondeo hacia arriba). Nunca deja precios bajo el costo ni mayorista sobre minorista. Cada cambio queda en `product_price_changes` (inmutable); los pedidos ya hechos conservan su precio. Los precios son **globales**.
- **Promociones** (`/backoffice/promotions`): descuentos por evento. El gerente maneja las de su sucursal; las de todas las sucursales son del superadmin.
- **Carritos abandonados** (`/backoffice/abandoned-carts`): índice de actividad en Redis (`carts:activity`); los carritos no pertenecen a una sucursal.
- **Sucursales, personal, auditoría, comercios (CUIT) y pagos a revisar**: solo SUPERADMIN. El personal se da de alta con rol y sucursal; cambiar rol/sucursal, dar de baja o restablecer la contraseña cierra sus sesiones; siempre queda al menos un superadmin activo. Todo cambio sensible escribe en `audit_logs`.
- **La baja es inmediata:** dar de baja a alguien, cambiarle el rol o la sucursal, o restablecerle la contraseña invalida también el acceso ya emitido (Redis `auth:revoked-after:<id>`, comprobado en cada request). Un ingreso dentro del mismo segundo de la revocación se rechaza a propósito.
- **Encargado de stock** (`ENCARGADO_STOCK`, pantalla `/encargado`): solo da de alta productos (`POST /products`, sin unidades) y corrige nombre, código, categoría, descripción y foto (`PATCH /products/:id`). No ve ni cambia precios, stock, pedidos ni métricas. Los precios y costos los cambian solo gerente y superadmin.

## Pruebas, seguridad y despliegue (Fase 8)
**Pruebas** (todas corren en CI en cada cambio, ver `.github/workflows/ci.yml`):
| Qué | Comando | Qué cubre |
|---|---|---|
| Unitarias (backend) | `cd backend && npm test` | reglas puras: precios, rangos de fechas, firma de Mercado Pago, CUIT, validación de entorno… |
| **Integración (backend)** | `docker compose --profile test run --rm --build e2e` | la aplicación real contra Postgres y Redis descartables y un Mercado Pago simulado: login y baja inmediata, permisos por rol y sucursal, compra → pago → sala, concurrencia de stock, backoffice, auditoría |
| **Pantallas (navegador)** | `cd frontend && npm run test:e2e` | Playwright contra la pila levantada: tienda, ingreso por rol, permisos en pantalla, recorrido del backoffice, cabeceras de seguridad |
| Calidad | `npm run lint` y `npm run typecheck` en cada proyecto | |

- La suite de integración **recrea** la base `omnistock_test` en cada corrida (nunca toca `omnistock`) y se niega a correr si la base no tiene "test" en el nombre o si Redis es la base 0. Fuera de Docker: definir `E2E_DATABASE_URL` y `E2E_REDIS_URL` y correr `npm run test:e2e` en `backend/`.
- Las pruebas de pantallas necesitan la pila arriba (`docker compose up -d`), sembrada con `prisma db seed` y el backend con `TRUST_PROXY=1` (cada ingreso sale con su propia IP para no chocar con el límite de intentos). Variables: `E2E_ADMIN_PASSWORD`, `E2E_DEMO_PASSWORD`.

**Seguridad:** controles, mapeo OWASP y riesgos conocidos en [`docs/SECURITY.md`](docs/SECURITY.md). Lo nuevo en esta fase:
- **Límite de intentos distribuido en Redis** (por IP y por cuenta): el mismo con varias instancias y tras un reinicio.
- **IP real detrás de proxy** (`TRUST_PROXY`); **verificación de `Origin`** en toda escritura; **helmet** con política estricta en la API y **CSP y cabeceras** en la tienda.
- **Validación de producción**: con un dominio real el backend exige https, cookies `Secure` y secretos que no parezcan de ejemplo.
- Dependencias sin vulnerabilidades conocidas (`multer`, `zod`), `npm audit` y escaneo de imágenes en CI.

**Despliegue:** [`docs/DEPLOY.md`](docs/DEPLOY.md) (VPS, Cloudflare, GitHub Actions, respaldos, rotación de secretos). Resumen:
- `docker-compose.prod.yml` agrega Caddy (HTTPS automático), contenedores de solo lectura y sin privilegios, y deja **solo 80/443** abiertos.
- `git tag v1.0.0 && git push --tags` → imágenes en GHCR → aprobación → `deploy/deploy.sh` (respaldo, migración, comprobación de salud y **vuelta atrás automática**).
- `deploy/backup.sh` y `deploy/restore.sh` para respaldar y restaurar la base y las fotos.

## Cuentas por email: verificación, recuperación e ingreso con Google
- **Verificar el email:** al registrarse llega un correo con un enlace (vale 24 h, un solo uso). Sin confirmarlo se puede navegar y armar el carrito, pero **no pagar** (`REQUIRE_VERIFIED_EMAIL=true`). La cuenta y el pago muestran un aviso con "Reenviar correo" (con espera de 1 minuto entre envíos).
- **Olvidé mi contraseña:** clientes (`/cuenta/olvide-contrasena`) y personal (`/recuperar`). Llega un enlace que vale 1 hora y se usa una sola vez; pedir otro invalida el anterior. Al cambiar la contraseña **se cierran todas las sesiones** (incluido el acceso ya emitido), se levanta el bloqueo por intentos fallidos y se avisa por correo del cambio. Siempre responde lo mismo, tenga o no cuenta el email.
- **Ingreso con Google** (opcional): botón "Continuar con Google" en el ingreso y el registro. Crea una cuenta de particular ya verificada o entra a la que tenga ese email (la deja verificada). Los comercios se registran por el formulario (necesitan CUIT). Quien entra por Google puede definir una contraseña con "Olvidé mi contraseña". Sin credenciales, el botón no aparece.
- **Seguridad de los enlaces:** token aleatorio de 256 bits; en Redis solo queda su hash. OpenID Connect con PKCE, `state` atado al navegador por cookie, `nonce`, validación de emisor/audiencia/vencimiento y de `email_verified`; `returnTo` solo admite rutas internas.
- **Correo:** `MAIL_DRIVER=smtp` con cualquier proveedor (Brevo, Mailgun, Amazon SES, Gmail con contraseña de aplicación…). En desarrollo, `MAIL_DRIVER=log` (por defecto) no envía nada: el correo completo, con su enlace, queda en `docker compose logs -f backend`. En producción con dominio real el backend **exige** `smtp`.
- Variables nuevas: `MAIL_DRIVER`, `MAIL_FROM`, `SMTP_*`, `STORE_NAME`, `REQUIRE_VERIFIED_EMAIL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (ver `.env.example`). Redirección autorizada en Google: `<PUBLIC_API_URL>/customers/auth/google/callback`.
