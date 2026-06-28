import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [JwtStrategy, JwtAuthGuard, OptionalJwtAuthGuard],
  exports: [JwtAuthGuard, JwtStrategy, OptionalJwtAuthGuard],
})
export class AuthSharedModule {}
