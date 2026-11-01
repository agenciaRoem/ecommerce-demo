import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { InjectConfig } from '../config/config.module';
import { Env } from '../config/env.validation';
import { RedisService } from '../redis/redis.service';
import { CustomerAuthResult, CustomersService } from './customers.service';

const STATE_TTL_SECONDS = 10 * 60;
const GOOGLE_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);
const DEFAULT_RETURN_TO = '/cuenta';

interface PendingLogin {
  verifier: string;
  nonce: string;
  returnTo: string;
}

interface IdTokenClaims {
  iss?: string;
  aud?: string;
  exp?: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  given_name?: string;
}

const sha256Base64Url = (value: string): string => createHash('sha256').update(value).digest('base64url');

/** Solo rutas internas de la tienda: nunca una URL completa (sería un redireccionamiento abierto). */
export function safeReturnTo(value: string | undefined): string {
  // Rechazar caracteres de control es justamente el objetivo de esta expresión.
  // eslint-disable-next-line no-control-regex
  if (!value || value.length > 200 || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\u0000-\u001f]/.test(value)) {
    return DEFAULT_RETURN_TO;
  }
  return value;
}

/**
 * "Ingresar con Google" (OpenID Connect, flujo de código con PKCE). Google demuestra que la persona es dueña de su
 * email; eso reemplaza a la contraseña y a la verificación por correo. Se defiende de: ataques de CSRF en el
 * ingreso (`state` atado al navegador por cookie), robo del código (PKCE), repetición (`nonce`) y redirecciones
 * abiertas (`returnTo` solo admite rutas internas).
 */
@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly customers: CustomersService,
    @InjectConfig() private readonly config: Env,
  ) {}

  get enabled(): boolean {
    return Boolean(this.config.GOOGLE_CLIENT_ID && this.config.GOOGLE_CLIENT_SECRET);
  }

  /** Arma la dirección de Google a la que hay que mandar al navegador. */
  async begin(returnTo: string | undefined): Promise<{ url: string; state: string }> {
    this.assertEnabled();
    const state = randomBytes(24).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    const nonce = randomBytes(16).toString('base64url');
    const pending: PendingLogin = { verifier, nonce, returnTo: safeReturnTo(returnTo) };
    await this.redis.set(this.key(state), JSON.stringify(pending), 'EX', STATE_TTL_SECONDS);

    const url = new URL(this.config.GOOGLE_AUTH_URL);
    url.search = new URLSearchParams({
      client_id: this.config.GOOGLE_CLIENT_ID!,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: sha256Base64Url(verifier),
      code_challenge_method: 'S256',
      prompt: 'select_account',
    }).toString();
    return { url: url.toString(), state };
  }

  /** Cierra el ingreso: valida todo lo que Google devuelve y abre la sesión de la tienda. */
  async complete(code: string, state: string, stateCookie: string | undefined): Promise<{ result: CustomerAuthResult; returnTo: string }> {
    this.assertEnabled();
    if (!stateCookie || !this.sameValue(stateCookie, state)) throw new BadRequestException('El ingreso no se inició en este navegador');
    const stored = await this.redis.getdel(this.key(state));
    if (!stored) throw new BadRequestException('El ingreso venció. Probá de nuevo.');
    const pending = JSON.parse(stored) as PendingLogin;

    const claims = await this.exchange(code, pending);
    const result = await this.customers.signInWithVerifiedEmail({ email: claims.email!.toLowerCase(), name: claims.name ?? claims.given_name });
    return { result, returnTo: pending.returnTo };
  }

  private async exchange(code: string, pending: PendingLogin): Promise<IdTokenClaims> {
    let response: Response;
    try {
      response = await fetch(this.config.GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.config.GOOGLE_CLIENT_ID!,
          client_secret: this.config.GOOGLE_CLIENT_SECRET!,
          redirect_uri: this.redirectUri,
          grant_type: 'authorization_code',
          code_verifier: pending.verifier,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      this.logger.error(`Google no respondió: ${error instanceof Error ? error.message : String(error)}`);
      throw new ServiceUnavailableException('No se pudo conectar con Google. Probá de nuevo.');
    }
    if (!response.ok) throw new BadRequestException('Google rechazó el ingreso');

    const { id_token: idToken } = (await response.json()) as { id_token?: string };
    const claims = this.readClaims(idToken);
    // El token llega directo desde Google por HTTPS (no por el navegador): según OIDC alcanza con validar sus datos.
    const emailVerified = claims.email_verified === true || claims.email_verified === 'true';
    const valid =
      claims.iss !== undefined &&
      GOOGLE_ISSUERS.has(claims.iss) &&
      claims.aud === this.config.GOOGLE_CLIENT_ID &&
      typeof claims.exp === 'number' &&
      claims.exp * 1000 > Date.now() &&
      claims.nonce === pending.nonce &&
      emailVerified &&
      Boolean(claims.email);
    if (!valid) throw new BadRequestException('Google devolvió datos inválidos');
    return claims;
  }

  private readClaims(idToken: string | undefined): IdTokenClaims {
    const payload = idToken?.split('.')[1];
    if (!payload) throw new BadRequestException('Google devolvió datos inválidos');
    try {
      return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as IdTokenClaims;
    } catch {
      throw new BadRequestException('Google devolvió datos inválidos');
    }
  }

  private assertEnabled(): void {
    if (!this.enabled) throw new ServiceUnavailableException('El ingreso con Google no está habilitado');
  }

  private get redirectUri(): string {
    return `${this.config.PUBLIC_API_URL}/customers/auth/google/callback`;
  }

  private key(state: string): string {
    return `auth:oauth:google:${sha256Base64Url(state)}`;
  }

  private sameValue(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
  }
}
