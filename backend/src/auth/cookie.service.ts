import { Injectable } from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { InjectConfig } from '../config/config.module';
import { Env } from '../config/env.validation';
import { Audience, COOKIES } from './auth.constants';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class CookieService {
  constructor(@InjectConfig() private readonly config: Env) {}

  set(res: Response, aud: Audience, tokens: TokenPair): void {
    const names = COOKIES[aud];
    res.cookie(names.access, tokens.accessToken, {
      ...this.base(),
      path: '/',
      maxAge: this.config.JWT_ACCESS_TTL_SECONDS * 1000,
    });
    res.cookie(names.refresh, tokens.refreshToken, {
      ...this.base(),
      path: names.refreshPath,
      maxAge: this.config.JWT_REFRESH_TTL_SECONDS * 1000,
    });
  }

  clear(res: Response, aud: Audience): void {
    const names = COOKIES[aud];
    res.clearCookie(names.access, { ...this.base(), path: '/' });
    res.clearCookie(names.refresh, { ...this.base(), path: names.refreshPath });
  }

  private base(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.COOKIE_SECURE,
      sameSite: 'strict',
      domain: this.config.COOKIE_DOMAIN,
    };
  }
}
