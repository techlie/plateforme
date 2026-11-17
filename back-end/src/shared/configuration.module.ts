import { Global, Module } from '@nestjs/common';
import { CONFIGURATION, lireConfiguration } from './configuration';

@Global()
@Module({
  providers: [{ provide: CONFIGURATION, useFactory: () => lireConfiguration() }],
  exports: [CONFIGURATION],
})
export class ConfigurationModule {}
