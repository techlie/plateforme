import { Module } from '@nestjs/common';
import { SimulateurModule } from './modules/simulateur/simulateur.module';

@Module({
  imports: [SimulateurModule],
})
export class AppModule {}
