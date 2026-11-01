import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AccountRecoveryService } from './account-recovery.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CookieService } from './cookie.service';
import { EmailTokensService } from './email-tokens.service';
import { LoginAttemptsService } from './login-attempts.service';
import { SessionService } from './session.service';
import { SessionStore } from './session.store';
import { TokenService } from './token.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, TokenService, SessionStore, SessionService, CookieService, LoginAttemptsService, EmailTokensService, AccountRecoveryService],
  exports: [TokenService, SessionService, CookieService, LoginAttemptsService, AccountRecoveryService],
})
export class AuthModule {}
