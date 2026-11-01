# Seguridad

Qué protege el sistema, cómo, y qué queda pendiente. Está ordenado según el OWASP Top 10 (2021). Cada control indica dónde está en el código y qué prueba lo verifica.

## Controles por categoría

**A01 · Control de acceso roto**
- Autorización por rol en cada endpoint (`@Roles`, guard global; el superadmin siempre pasa) y **aislamiento por sucursal** en el servidor (`@CurrentBranchScope`): un gerente o un empleado de sala no ve ni modifica otra sucursal aunque lo pida (`?branchId=` ajeno → 403/404).
- Los clientes tienen una sesión distinta (claim `aud`) que no sirve en el panel interno, y al revés.
- Rol nuevo `ENCARGADO_STOCK`: solo alta y edición de productos; precios, stock, pedidos y administración dan 403.
- *Pruebas:* `backend/test/rbac-products.e2e-spec.ts` (matriz de endpoints × roles, aislamiento, encargado), `orders-payments` (sala de otra sucursal → 404).

**A02 · Fallas criptográficas**
- Contraseñas con **Argon2**. Sesiones con JWT firmados en cookies **HttpOnly + SameSite=Strict + Secure** (en producción), refresh con **rotación y detección de reutilización**.
- Credenciales de Mercado Pago cifradas en la base con **AES-256-GCM** (`SETTINGS_ENCRYPTION_KEY`); nunca salen por la API ni se registran.
- HTTPS obligatorio en producción: el backend **no arranca** con URLs `http`, cookies sin `Secure` o secretos que parecen de ejemplo (`env.validation.ts`). HSTS en API, tienda y proxy.
- *Pruebas:* `env.validation.spec.ts`, `auth-security` (cookies, rotación).

**A03 · Inyección**
- Toda entrada se valida con **Zod** (esquemas estrictos, límites de largo, sin caracteres de control/NUL). Prisma parametriza las consultas; el SQL a mano usa parámetros.
- XSS: React escapa por defecto; **CSP** restrictiva en la tienda y `default-src 'none'` en la API.
- *Pruebas:* validaciones en `rbac-products` y `backoffice` (NUL, rangos, decimales, enums).

**A04 · Diseño inseguro**
- Integridad en la base, no solo en el código: `CHECK` (stock ≥ 0, reservado ≤ stock, precios ≥ 0), **tablas inmutables por trigger** (`audit_logs`, `stock_movements`, `order_status_events`, `product_price_changes`).
- Stock con transacciones ACID y actualizaciones condicionales: no hay sobreventa bajo concurrencia.
- Pagos: el monto y la moneda se **re-consultan a Mercado Pago** antes de dar un pedido por pagado; avisos firmados (HMAC) e idempotentes.
- *Pruebas:* `orders-payments` (8 compradores, 3 unidades → exactamente 3 ganan; monto distinto; aviso repetido; firma inválida).

**A05 · Configuración incorrecta**
- Helmet en la API; cabeceras de seguridad en la tienda (CSP, `X-Frame-Options: DENY`, `Permissions-Policy`, `nosniff`, `Referrer-Policy`); sin `X-Powered-By`.
- Contenedores sin root, **sistema de archivos de solo lectura**, sin capacidades extra (`cap_drop: ALL`), `no-new-privileges`, límites de memoria. Postgres y Redis **sin puertos publicados**; solo Caddy escucha.
- CORS restringido al origen de la tienda; **verificación de `Origin`** en toda escritura (defensa en profundidad contra CSRF).
- *Pruebas:* `auth-security` (CORS, CSRF, cabeceras), `frontend/e2e/smoke.spec.ts` (cabeceras de la tienda); arranque real del compose de producción.

**A06 · Componentes vulnerables**
- `npm audit --omit=dev` en CI (falla con severidad alta), escaneo de las imágenes con Trivy, Dependabot semanal.
- Estado al cerrar la Fase 8: **0 vulnerabilidades** en producción en backend y frontend (se actualizaron `multer` y `zod`).

**A07 · Fallas de identificación y autenticación**
- Límite de intentos **por IP** (5/min en login, distribuido en Redis) y **por cuenta** (10 fallos/15 min, cuente o no con la cuenta para no revelar cuáles existen).
- Mismo mensaje para email inexistente y contraseña mala; se iguala el tiempo de respuesta.
- **La baja es inmediata**: dar de baja, cambiar rol/sucursal o restablecer la contraseña invalida también el acceso ya emitido.
- *Pruebas:* `auth-security` (fuerza bruta, bloqueo por cuenta, baja inmediata, reutilización de refresh).

**A07 (cont.) · Cuentas por email**
- Enlaces de verificación y de restablecimiento: aleatorios de 256 bits, de un solo uso, con vencimiento; en Redis solo se guarda su hash. Pedir un restablecimiento **nunca revela** si el email tiene cuenta y tiene espera de 1 minuto por cuenta y límite por IP.
- Restablecer cierra todas las sesiones (también el acceso ya emitido). Una pestaña vieja que intenta renovar su sesión después **no** cierra la sesión nueva.
- Ingreso con Google: OpenID Connect con PKCE, `state` atado al navegador, `nonce`, validación de emisor, audiencia, vencimiento y `email_verified`; sin redirecciones abiertas.
- *Pruebas:* `backend/test/account-recovery.e2e-spec.ts` (verificación, recuperación de clientes y personal, y 15 casos de ataque al ingreso con Google).

**A08 · Integridad de datos y software**
- Imágenes de despliegue construidas por el pipeline y desplegadas por etiqueta; claves SSH de despliegue dedicadas, `known_hosts` fijo y entorno `production` con aprobación.
- Los avisos de pago se aceptan solo con firma válida.

**A09 · Registro y monitoreo**
- `audit_logs` inmutable: altas/bajas/cambios de personal, sucursales, precios (con antes y después), promociones, aprobación de CUIT, resolución de pagos. **Nunca** guarda contraseñas ni credenciales. Visible solo para el superadmin.
- Historial inmutable de estados de cada pedido (quién y cuándo) y de cada movimiento de stock.

**A10 · SSRF**
- El backend solo llama a una URL externa: la API de Mercado Pago, fija por configuración; ninguna URL sale de datos del usuario.

## Riesgos conocidos (leer antes de abrir al público)
1. **Sin segundo factor** para el personal. Recomendado antes de vender, al menos para superadmin y gerentes.
2. **Quien controla el correo de una cuenta controla la cuenta** (así funciona toda recuperación por email). Por eso el correo del superadmin tiene que tener su propia protección (segundo factor), y los correos de la tienda salen con SPF y DKIM configurados.
3. **CSP con `'unsafe-inline'` en scripts**: es lo que exigen las páginas pre-renderizadas de Next. Usar nonces obligaría a renderizar todo en cada pedido. Se compensa con el resto de la política (sin plugins, sin iframes ajenos, sin formularios hacia afuera).
4. **Un bloqueo por cuenta puede usarse para molestar** a alguien (10 intentos fallidos lo bloquean 15 min). Es el costo de frenar la fuerza bruta distribuida; el bloqueo se levanta solo.
5. **Un solo nodo**: Postgres, Redis y las fotos viven en un servidor. Ver "Crecer" en `docs/DEPLOY.md` y probar la restauración de respaldos.
6. Los registros no se centralizan (se rotan en el servidor). Para un negocio más grande, enviarlos a un servicio externo.
7. No hay verificación de que el CUIT exista en ARCA: una persona lo aprueba mirando la constancia (queda auditado).

## Reportar un problema
Escribir al responsable del sistema con el detalle y cómo reproducirlo. No publicar el hallazgo hasta que esté corregido.
