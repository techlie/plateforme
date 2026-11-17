import { Global, Module } from '@nestjs/common';
import { CONFIGURATION, Configuration } from '../configuration';
import { CourrielService, creerTransport, TransportCourriel } from './courriel.service';

@Global()
@Module({
  providers: [
    {
      provide: TransportCourriel,
      useFactory: (configuration: Configuration) => creerTransport(configuration),
      inject: [CONFIGURATION],
    },
    CourrielService,
  ],
  exports: [CourrielService],
})
export class CourrielModule {}
