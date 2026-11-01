import { loadEnv } from './env.validation';

const valid = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  SETTINGS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
};

describe('loadEnv', () => {
  it('aplica valores por defecto', () => {
    const env = loadEnv(valid);
    expect(env.PORT).toBe(4000);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000']);
    expect(env.COOKIE_SECURE).toBe(false);
  });

  it('activa cookies Secure por defecto en producción', () => {
    expect(loadEnv({ ...valid, NODE_ENV: 'production' }).COOKIE_SECURE).toBe(true);
  });

  it('separa múltiples orígenes CORS', () => {
    const env = loadEnv({ ...valid, CORS_ORIGINS: 'https://a.com, https://b.com' });
    expect(env.CORS_ORIGINS).toEqual(['https://a.com', 'https://b.com']);
  });

  it('rechaza secretos cortos', () => {
    expect(() => loadEnv({ ...valid, JWT_ACCESS_SECRET: 'corto' })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('exige una clave de cifrado de 32 bytes', () => {
    expect(() => loadEnv({ ...valid, SETTINGS_ENCRYPTION_KEY: 'corta' })).toThrow(/SETTINGS_ENCRYPTION_KEY/);
    expect(() => loadEnv({ ...valid, SETTINGS_ENCRYPTION_KEY: undefined })).toThrow(/SETTINGS_ENCRYPTION_KEY/);
  });

  it('normaliza las URLs públicas quitando la barra final', () => {
    const env = loadEnv({ ...valid, PUBLIC_API_URL: 'https://api.tienda.com.ar/' });
    expect(env.PUBLIC_API_URL).toBe('https://api.tienda.com.ar');
    expect(env.MERCADOPAGO_API_URL).toBe('https://api.mercadopago.com');
  });

  it('rechaza secretos iguales', () => {
    expect(() => loadEnv({ ...valid, JWT_REFRESH_SECRET: valid.JWT_ACCESS_SECRET })).toThrow(/distintos/);
  });

  describe('producción con dominio real', () => {
    const prod = {
      ...valid,
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'k9Xp2mQw7LrT4vYb8NcZ1dFg5HjS3aE6uIoPq0WxRtYe',
      JWT_REFRESH_SECRET: 'Zb3Nm8Qa1Wx5Ec7Rv9Ty2Ui4Op6As0DfGhJkLqWeRtYu',
      PUBLIC_STORE_URL: 'https://tienda.com.ar',
      PUBLIC_API_URL: 'https://api.tienda.com.ar',
      MEDIA_PUBLIC_URL: 'https://api.tienda.com.ar/media',
      CORS_ORIGINS: 'https://tienda.com.ar',
      MAIL_DRIVER: 'smtp',
      SMTP_HOST: 'smtp.ejemplo.com',
    };

    it('acepta una configuración correcta', () => {
      expect(() => loadEnv(prod)).not.toThrow();
    });

    it('exige https en las URLs públicas y en CORS', () => {
      expect(() => loadEnv({ ...prod, PUBLIC_API_URL: 'http://api.tienda.com.ar' })).toThrow(/PUBLIC_API_URL/);
      expect(() => loadEnv({ ...prod, CORS_ORIGINS: 'http://tienda.com.ar' })).toThrow(/CORS_ORIGINS/);
    });

    it('no permite desactivar las cookies Secure', () => {
      expect(() => loadEnv({ ...prod, COOKIE_SECURE: 'false' })).toThrow(/COOKIE_SECURE/);
    });

    it('rechaza secretos que parecen de ejemplo', () => {
      expect(() => loadEnv({ ...prod, JWT_ACCESS_SECRET: 'change-me-change-me-change-me-change-me' })).toThrow(/JWT_ACCESS_SECRET/);
    });

    it('en una tienda local (localhost) no aplica estas exigencias', () => {
      expect(() => loadEnv({ ...valid, NODE_ENV: 'production', COOKIE_SECURE: 'false' })).not.toThrow();
    });
  });

  it('TRUST_PROXY es 0 por defecto y acepta la cantidad de proxies', () => {
    expect(loadEnv(valid).TRUST_PROXY).toBe(0);
    expect(loadEnv({ ...valid, TRUST_PROXY: '2' }).TRUST_PROXY).toBe(2);
  });
});

describe('correo y Google', () => {
  it('el correo es "log" por defecto y la verificación de email es obligatoria', () => {
    const env = loadEnv(valid);
    expect(env.MAIL_DRIVER).toBe('log');
    expect(env.REQUIRE_VERIFIED_EMAIL).toBe(true);
  });

  it('smtp necesita servidor; usuario y contraseña van juntos', () => {
    expect(() => loadEnv({ ...valid, MAIL_DRIVER: 'smtp' })).toThrow(/SMTP_HOST/);
    expect(() => loadEnv({ ...valid, MAIL_DRIVER: 'smtp', SMTP_HOST: 'smtp.ejemplo.com', SMTP_USER: 'a' })).toThrow(/SMTP_PASS/);
    expect(() => loadEnv({ ...valid, MAIL_DRIVER: 'smtp', SMTP_HOST: 'smtp.ejemplo.com', SMTP_USER: 'a', SMTP_PASS: 'b' })).not.toThrow();
  });

  it('las credenciales de Google van juntas', () => {
    expect(() => loadEnv({ ...valid, GOOGLE_CLIENT_ID: 'id' })).toThrow(/GOOGLE_CLIENT_SECRET/);
    expect(() => loadEnv({ ...valid, GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secreto' })).not.toThrow();
  });

  it('en producción con dominio real el correo tiene que enviarse de verdad', () => {
    const prod = {
      ...valid,
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'k9Xp2mQw7LrT4vYb8NcZ1dFg5HjS3aE6uIoPq0WxRtYe',
      JWT_REFRESH_SECRET: 'Zb3Nm8Qa1Wx5Ec7Rv9Ty2Ui4Op6As0DfGhJkLqWeRtYu',
      PUBLIC_STORE_URL: 'https://tienda.com.ar',
      PUBLIC_API_URL: 'https://api.tienda.com.ar',
      MEDIA_PUBLIC_URL: 'https://api.tienda.com.ar/media',
      CORS_ORIGINS: 'https://tienda.com.ar',
    };
    expect(() => loadEnv({ ...prod, MAIL_DRIVER: 'log' })).toThrow(/MAIL_DRIVER/);
    expect(() => loadEnv({ ...prod, MAIL_DRIVER: 'smtp', SMTP_HOST: 'smtp.ejemplo.com' })).not.toThrow();
  });
});
