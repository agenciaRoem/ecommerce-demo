import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CustomersController } from './customers.controller';
import { GoogleAuthController } from './google-auth.controller';
import { GoogleOAuthService } from './google-oauth.service';
import { CustomersService } from './customers.service';

@Module({
  imports: [AuthModule],
  controllers: [CustomersController, GoogleAuthController],
  providers: [CustomersService, GoogleOAuthService],
})
export class CustomersModule {}
