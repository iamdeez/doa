import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthSharedModule } from '../../shared/auth/auth-shared.module';
import { MailModule } from '../../infrastructure/mail/mail.module';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { SocialAuthService } from './social-auth.service';
import { SocialProviderResolver } from './social/social-provider.resolver';
import { KakaoProvider } from './social/kakao.provider';
import { GoogleProvider } from './social/google.provider';
// NaverProvider 는 이번 릴리즈에서 미와이어(SEC-001/GAP-014-08/GAP-014-10) — social/naver.provider.ts 참조.

@Module({
  imports: [
    // JwtModule without global secret — each signAsync call provides its own secret
    JwtModule.register({}),
    AuthSharedModule,
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    SocialAuthService,
    SocialProviderResolver,
    KakaoProvider,
    GoogleProvider,
  ],
})
export class AuthModule {}
