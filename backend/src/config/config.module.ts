import { Global, Inject, Module } from '@nestjs/common';
import { Env, loadEnv } from './env.validation';

export const APP_CONFIG = Symbol('APP_CONFIG');

/** Inyecta la configuración validada: `constructor(@InjectConfig() private readonly config: Env)`. */
export const InjectConfig = () => Inject(APP_CONFIG);

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: (): Env => loadEnv() }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
