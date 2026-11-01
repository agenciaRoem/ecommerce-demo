import { expect, test, type Page } from '@playwright/test';

/** Cuentas sembradas (`prisma/seed.ts` con SEED_DEMO_STAFF_PASSWORD). Las contraseñas llegan por entorno. */
const ADMIN = { email: process.env.E2E_ADMIN_EMAIL ?? 'admin@omnistock.local', password: process.env.E2E_ADMIN_PASSWORD ?? '' };
const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD ?? '';

const ROLES = [
  { name: 'superadmin', ...ADMIN, lands: '/admin' },
  { name: 'gerente', email: 'gerente.cen@omnistock.local', password: DEMO_PASSWORD, lands: '/admin' },
  { name: 'sala', email: 'sala.cen@omnistock.local', password: DEMO_PASSWORD, lands: '/sala' },
  { name: 'stockeo', email: 'stockeo.cen@omnistock.local', password: DEMO_PASSWORD, lands: '/stockeo' },
  { name: 'encargado de stock', email: 'encargado.cen@omnistock.local', password: DEMO_PASSWORD, lands: '/encargado' },
] as const;

/** Errores del navegador que una pantalla sana no debería producir (incluye las violaciones de la política de contenido). */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    // Los 4xx de la API en pruebas de acceso denegado son esperados; lo demás no.
    if (message.type() === 'error' && !/Failed to load resource.*(400|401|403|404|409|429)/.test(message.text())) errors.push(`console: ${message.text()}`);
  });
  return errors;
}

/** Cada ingreso sale con su propia IP (el límite de tasa de login es por IP: 5 por minuto). Requiere TRUST_PROXY=1 en el backend de prueba. */
async function login(page: Page, email: string, password: string) {
  const ip = `10.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
  await page.context().setExtraHTTPHeaders({ 'X-Forwarded-For': ip });
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

test.beforeAll(() => {
  if (!ADMIN.password || !DEMO_PASSWORD) throw new Error('Definí E2E_ADMIN_PASSWORD y E2E_DEMO_PASSWORD (las contraseñas con las que se sembró la base).');
});

test.describe('tienda pública', () => {
  test('carga sin errores y se puede recorrer', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await expect(page.getByRole('link', { name: /productos/i }).first()).toBeVisible();
    await page.goto('/productos');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.goto('/sucursales');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.goto('/carrito');
    expect(errors).toEqual([]);
  });

  test('responde con las cabeceras de seguridad', async ({ request }) => {
    const response = await request.get('/');
    const headers = response.headers();
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['content-security-policy']).toContain("object-src 'none'");
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['permissions-policy']).toContain('camera=(self)');
    expect(headers['x-powered-by']).toBeUndefined();
  });

  test('quien no inició sesión no entra a las pantallas internas', async ({ page }) => {
    for (const path of ['/admin', '/sala', '/stockeo', '/encargado']) {
      await page.goto(path);
      await page.waitForURL('**/login');
    }
  });
});

test.describe('ingreso del personal', () => {
  for (const role of ROLES) {
    test(`${role.name} aterriza en ${role.lands}`, async ({ page }) => {
      const errors = collectErrors(page);
      await login(page, role.email, role.password);
      await page.waitForURL(`**${role.lands}`, { timeout: 15_000 });
      expect(errors).toEqual([]);
    });
  }

  test('una contraseña incorrecta no deja pasar y muestra el error', async ({ page }) => {
    await login(page, ADMIN.email, 'contraseña-incorrecta-123');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('permisos en pantalla', () => {
  test('la sala no entra al backoffice', async ({ page }) => {
    await login(page, 'sala.cen@omnistock.local', DEMO_PASSWORD);
    await page.waitForURL('**/sala');
    await page.goto('/admin');
    await expect(page.getByText('Sin acceso a esta sección')).toBeVisible();
  });

  test('el encargado de stock solo ve productos', async ({ page }) => {
    await login(page, 'encargado.cen@omnistock.local', DEMO_PASSWORD);
    await page.waitForURL('**/encargado');
    await expect(page.getByRole('heading', { name: 'Productos', level: 1 })).toBeVisible();
    for (const path of ['/admin/precios', '/stockeo', '/sala']) {
      await page.goto(path);
      await expect(page.getByText('Sin acceso a esta sección')).toBeVisible();
    }
  });

  test('el gerente ve la gerencia y no la administración', async ({ page }) => {
    await login(page, 'gerente.cen@omnistock.local', DEMO_PASSWORD);
    await page.waitForURL('**/admin');
    const menu = page.getByRole('navigation', { name: 'Secciones del backoffice' });
    await expect(menu.getByRole('link', { name: 'Precios y costos' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Personal' })).toHaveCount(0);
    await page.goto('/admin/personal');
    await expect(page.getByText('Esta sección es solo para el superadmin.')).toBeVisible();
  });
});

test('el superadmin recorre todo el backoffice sin errores', async ({ page }) => {
  const errors = collectErrors(page);
  await login(page, ADMIN.email, ADMIN.password);
  await page.waitForURL('**/admin');

  const sections: [string, string][] = [
    ['/admin', 'Resumen de ventas'],
    ['/admin/precios', 'Precios y costos'],
    ['/admin/promociones', 'Promociones'],
    ['/admin/carritos', 'Carritos abandonados'],
    ['/admin/sucursales', 'Sucursales'],
    ['/admin/personal', 'Personal'],
    ['/admin/comercios', 'Comercios (CUIT)'],
    ['/admin/incidencias', 'Pagos a revisar'],
    ['/admin/auditoria', 'Auditoría'],
    ['/admin/pagos', 'Mercado Pago'],
  ];
  for (const [path, heading] of sections) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test.describe('recuperación de cuentas', () => {
  test('el formulario de clientes responde lo mismo exista o no la cuenta', async ({ page }) => {
    await page.context().setExtraHTTPHeaders({ 'X-Forwarded-For': `10.${Math.floor(Math.random() * 250) + 1}.0.${Math.floor(Math.random() * 250) + 1}` });
    await page.goto('/cuenta/ingresar');
    await page.getByRole('link', { name: 'Olvidé mi contraseña' }).click();
    await page.waitForURL('**/cuenta/olvide-contrasena');
    await page.getByLabel('Email de tu cuenta').fill(`nadie.${Date.now()}@ejemplo.com`);
    await page.getByRole('button', { name: 'Enviarme el enlace' }).click();
    await expect(page.getByRole('heading', { name: 'Revisá tu correo' })).toBeVisible();
  });

  test('un enlace de restablecimiento inválido avisa y ofrece pedir otro', async ({ page }) => {
    await page.goto(`/cuenta/restablecer?token=${'x'.repeat(43)}`);
    await page.getByLabel('Contraseña nueva').fill('una-contraseña-larga-1');
    await page.getByLabel('Repetí la contraseña').fill('una-contraseña-larga-1');
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    await expect(page.getByRole('heading', { name: 'El enlace no sirve' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Pedir un enlace nuevo' })).toBeVisible();
  });

  test('las contraseñas que no coinciden se avisan antes de enviar', async ({ page }) => {
    await page.goto(`/cuenta/restablecer?token=${'x'.repeat(43)}`);
    await page.getByLabel('Contraseña nueva').fill('una-contraseña-larga-1');
    await page.getByLabel('Repetí la contraseña').fill('otra-distinta-12345');
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    await expect(page.getByText('Las contraseñas no coinciden.')).toBeVisible();
  });

  test('un enlace de verificación inválido avisa', async ({ page }) => {
    await page.goto(`/cuenta/verificar?token=${'x'.repeat(43)}`);
    await expect(page.getByRole('heading', { name: 'El enlace no sirve' })).toBeVisible();
  });

  test('el personal puede pedir recuperar su contraseña desde el ingreso', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Olvidé mi contraseña' }).click();
    await page.waitForURL('**/recuperar');
    await page.getByLabel('Email de tu cuenta').fill('alguien@omnistock.local');
    await page.getByRole('button', { name: 'Enviarme el enlace' }).click();
    await expect(page.getByRole('heading', { name: 'Revisá tu correo' })).toBeVisible();
  });

  test('sin credenciales de Google el botón no aparece', async ({ page }) => {
    await page.goto('/cuenta/ingresar');
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
    await expect(page.getByText('Continuar con Google')).toHaveCount(0);
  });
});
