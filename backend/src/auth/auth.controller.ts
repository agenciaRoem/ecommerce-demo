import { Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { COOKIES } from './auth.constants';
import { ForgotPasswordDto, LoginDto, ResetPasswordDto, forgotPasswordSchema, loginSchema, resetPasswordSchema } from './auth.schemas';
import { AccountRecoveryService } from './account-recovery.service';
import { AuthService } from './auth.service';
import { CookieService } from './cookie.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: CookieService,
    private readonly recovery: AccountRecoveryService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body(new ZodValidationPipe(loginSchema)) body: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.auth.login(body.email, body.password);
    this.cookies.set(res, 'staff', tokens);
    return user;
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[COOKIES.staff.refresh] as string | undefined;
    if (!token) throw new UnauthorizedException('Sesión inválida o expirada');
    try {
      const { user, tokens } = await this.auth.refresh(token);
      this.cookies.set(res, 'staff', tokens);
      return user;
    } catch (error) {
      this.cookies.clear(res, 'staff');
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[COOKIES.staff.refresh] as string | undefined);
    this.cookies.clear(res, 'staff');
  }

  /** Responde siempre 204: no revela si el email tiene cuenta. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password/forgot')
  @HttpCode(204)
  async forgotPassword(@Body(new ZodValidationPipe(forgotPasswordSchema)) body: ForgotPasswordDto) {
    await this.recovery.requestPasswordReset('staff', body.email);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('password/reset')
  @HttpCode(204)
  async resetPassword(@Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordDto) {
    await this.recovery.completePasswordReset('staff', body.token, body.password);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.getProfile(user.id);
  }
}
