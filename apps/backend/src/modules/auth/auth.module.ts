import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';

@Module({
  imports: [
    // JwtModule without global secret — each signAsync call provides its own secret
    JwtModule.register({}),
    AuthSharedModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository],
})
export class AuthModule {}
