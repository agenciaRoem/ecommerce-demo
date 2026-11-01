import { Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AccountRecoveryService } from '../auth/account-recovery.service';
import { COOKIES } from '../auth/auth.constants';
import { ForgotPasswordDto, ResetPasswordDto, VerifyEmailDto, forgotPasswordSchema, resetPasswordSchema, verifyEmailSchema } from '../auth/auth.schemas';
import { CookieService } from '../auth/cookie.service';
import { CustomerOnly } from '../common/decorators/audience.decorator';
import { CurrentCustomer } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedCustomer } from '../common/types/authenticated-user';
import {
  CustomerLoginDto,
  RegisterCustomerDto,
  customerLoginSchema,
  registerCustomerSchema,
} from './customers.schemas';
import { CustomersService } from './customers.service';

@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customers: CustomersService,
    private readonly cookies: CookieService,
    private readonly recovery: AccountRecoveryService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  @HttpCode(201)
  async register(
    @Body(new ZodValidationPipe(registerCustomerSchema)) body: RegisterCustomerDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { customer, tokens } = await this.customers.register(body);
    this.cookies.set(res, 'customer', tokens);
    return customer;
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('auth/login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(customerLoginSchema)) body: CustomerLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { customer, tokens } = await this.customers.login(body.email, body.password);
    this.cookies.set(res, 'customer', tokens);
    return customer;
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('auth/refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[COOKIES.customer.refresh] as string | undefined;
    if (!token) throw new UnauthorizedException('Sesión inválida o expirada');
    try {
      const { customer, tokens } = await this.customers.refresh(token);
      this.cookies.set(res, 'customer', tokens);
      return customer;
    } catch (error) {
      this.cookies.clear(res, 'customer');
      throw error;
    }
  }

  @Public()
  @Post('auth/logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.customers.logout(req.cookies?.[COOKIES.customer.refresh] as string | undefined);
    this.cookies.clear(res, 'customer');
  }

  @CustomerOnly()
  @Get('me')
  me(@CurrentCustomer() customer: AuthenticatedCustomer) {
    return this.customers.getProfile(customer.id);
  }

  /** El cliente toca el enlace del correo. Pública: se abre desde el mail, quizás en otro dispositivo. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-email')
  @HttpCode(204)
  async verifyEmail(@Body(new ZodValidationPipe(verifyEmailSchema)) body: VerifyEmailDto) {
    await this.recovery.verifyEmail(body.token);
  }

  @CustomerOnly()
  @Throttle({ default: { limit: 5, ttl: 60 * 60_000 } })
  @Post('verify-email/resend')
  @HttpCode(204)
  async resendVerification(@CurrentCustomer() customer: AuthenticatedCustomer) {
    await this.recovery.sendVerification(customer.id, { enforceCooldown: true });
  }

  /** Responde siempre 204: no revela si el email tiene cuenta. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password/forgot')
  @HttpCode(204)
  async forgotPassword(@Body(new ZodValidationPipe(forgotPasswordSchema)) body: ForgotPasswordDto) {
    await this.recovery.requestPasswordReset('customer', body.email);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('password/reset')
  @HttpCode(204)
  async resetPassword(@Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordDto) {
    await this.recovery.completePasswordReset('customer', body.token, body.password);
  }
}
