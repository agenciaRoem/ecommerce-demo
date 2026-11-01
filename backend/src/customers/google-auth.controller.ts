import { Controller, Get, NotFoundException, Query, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { z } from 'zod';
import { CookieService } from '../auth/cookie.service';
import { InjectConfig } from '../config/config.module';
import { Env } from '../config/env.validation';
import { Public } from '../common/decorators/public.decorator';
import { GoogleOAuthService, safeReturnTo } from './google-oauth.service';

/** La cookie que ata el ingreso a este navegador. Solo viaja al callback y dura lo que dura el ingreso. */
const STATE_COOKIE = 'oauth_state';
const STATE_PATH = '/customers/auth/google';

const callbackSchema = z.object({
  code: z.string().min(1).max(2048).optional(),
  state: z.string().min(1).max(200).optional(),
  error: z.string().max(200).optional(),
});

@Public()
@Controller('customers/auth')
export class GoogleAuthController {
  constructor(
    private readonly google: GoogleOAuthService,
    private readonly cookies: CookieService,
    @InjectConfig() private readonly config: Env,
  ) {}

  /** Qué formas de ingreso están disponibles (la tienda muestra el botón de Google solo si está habilitado). */
  @Get('providers')
  providers() {
    return { google: this.google.enabled };
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('google')
  async start(@Query('returnTo') returnTo: string | undefined, @Res() res: Response) {
    if (!this.google.enabled) throw new NotFoundException();
    const { url, state } = await this.google.begin(typeof returnTo === 'string' ? returnTo : undefined);
    // Lax y no Strict: la vuelta desde Google es una navegación entre sitios y una cookie Strict no viajaría.
    res.cookie(STATE_COOKIE, state, this.stateCookieOptions({ maxAge: 10 * 60 * 1000 }));
    res.redirect(302, url);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('google/callback')
  async callback(@Query() query: Record<string, unknown>, @Req() req: Request, @Res() res: Response) {
    const parsed = callbackSchema.safeParse(query);
    const stateCookie = req.cookies?.[STATE_COOKIE] as string | undefined;
    res.clearCookie(STATE_COOKIE, this.stateCookieOptions());

    if (!parsed.success || parsed.data.error || !parsed.data.code || !parsed.data.state) {
      return res.redirect(302, this.storeUrl('/cuenta/ingresar?error=google'));
    }
    try {
      const { result, returnTo } = await this.google.complete(parsed.data.code, parsed.data.state, stateCookie);
      this.cookies.set(res, 'customer', result.tokens);
      // La tienda marca la sesión en el navegador (cookie de apoyo que solo puede escribir el cliente) y sigue al destino.
      return res.redirect(302, this.storeUrl(`/cuenta/continuar?next=${encodeURIComponent(safeReturnTo(returnTo))}`));
    } catch {
      // Cualquier falla vuelve al ingreso con un aviso genérico: el detalle no le sirve a quien intenta un ataque.
      return res.redirect(302, this.storeUrl('/cuenta/ingresar?error=google'));
    }
  }

  private stateCookieOptions(extra: CookieOptions = {}): CookieOptions {
    return { httpOnly: true, secure: this.config.COOKIE_SECURE, sameSite: 'lax', domain: this.config.COOKIE_DOMAIN, path: STATE_PATH, ...extra };
  }

  private storeUrl(path: string): string {
    return `${this.config.PUBLIC_STORE_URL}${path}`;
  }
}
