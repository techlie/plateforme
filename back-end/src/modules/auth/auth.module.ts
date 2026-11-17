import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { AccesGuard } from './guards/acces.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthRepository, AuthService, { provide: APP_GUARD, useClass: AccesGuard }],
  exports: [AuthService, AuthRepository],
})
export class AuthModule {}
