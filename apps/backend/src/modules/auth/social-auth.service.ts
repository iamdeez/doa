import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { SocialProviderResolver } from './social/social-provider.resolver';

export interface SocialLoginResult {
  accessToken: string;
  refreshToken: string;
}

/**
 * FR-005 자동 연동(email 매칭, path 3b) 허용 provider 화이트리스트.
 * Kakao·Google 은 토큰의 app/client 바인딩(app_id/aud)을 검증하여 타 앱 발급 토큰의
 * 재전송을 차단하므로 자동 연동이 안전하다.
 *
 * Naver 는 이번 릴리즈에서 `SocialProviderResolver`/`SocialLoginDto` 화이트리스트에서
 * 완전히 제외되어(SEC-001/GAP-014-08/GAP-014-10) `login()` 자체가 호출될 수 없으므로
 * 여기서는 등장하지 않는다. 이 상수는 방어적 심층 방어(defense-in-depth) 목적으로,
 * 향후 app/client 바인딩 검증이 없는 provider 가 추가되더라도 자동 연동만은 기본
 * 차단되도록 화이트리스트 방식(비신뢰 provider 를 기본값으로 배제)을 유지한다.
 */
const AUTO_LINK_PROVIDERS: ReadonlySet<string> = new Set(['kakao', 'google']);

/**
 * 소셜 로그인 도메인 서비스.
 * 계정 해석 우선순위 (ADR-003):
 *   a) provider+providerId 일치 → 기존 소셜 계정 소유 사용자
 *   b) email 일치 → 기존 이메일 가입자에 소셜 계정 자동 연동 (AUTO_LINK_PROVIDERS 한정, SEC-001)
 *   c) 신규 사용자 생성 + 소셜 계정 생성 (두 단계 순차 실행)
 *
 * AUTO_LINK_PROVIDERS 에 없는 provider 는 email 이 기존 계정과 겹치면 연동하지
 * 않고 409 Conflict 로 거부한다(자동 연동도, 동일 email 의 신규 독립 계정 생성도 하지 않음
 * — users.email 유니크 제약상 후자는 불가능하며 전자는 SEC-001 정책상 금지). 현재
 * 활성 provider(kakao·google) 는 모두 이 화이트리스트에 포함되어 있어 이 분기는
 * 방어적 코드로만 남는다.
 */
@Injectable()
export class SocialAuthService {
  constructor(
    private readonly resolver: SocialProviderResolver,
    private readonly repo: AuthRepository,
    private readonly authService: AuthService,
  ) {}

  async login(provider: string, token: string): Promise<SocialLoginResult> {
    // 1. 토큰 검증 및 프로필 획득
    const providerImpl = this.resolver.resolve(provider);
    const profile = await providerImpl.verify(token);

    // 2. FR-003: 이메일 없는 소셜 계정은 거부 (400 — 사용자 요청 오류)
    if (!profile.email) {
      throw new BadRequestException(
        'Social account email is required but was not provided by the provider',
      );
    }

    const email = profile.email;
    const autoLinkAllowed = AUTO_LINK_PROVIDERS.has(provider);

    // 3a. provider+providerId 로 기존 연동 계정 조회
    const existing = await this.repo.findByProviderAndProviderId(provider, profile.providerId);
    if (existing) {
      return this.authService.issueTokensForUser(existing.user);
    }

    // 3b. 동일 이메일로 이미 가입된 사용자 확인
    const existingUser = await this.repo.findUserByEmail(email);
    if (existingUser) {
      if (!autoLinkAllowed) {
        // Naver: 앱 바인딩 검증 수단 부재로 자동 연동 비활성(SEC-001/GAP-014-08).
        // 기존 계정에 연결하지 않고, 동일 email 의 독립 계정 생성도 불가하므로 거부한다.
        throw new ConflictException(
          'Email already registered. Automatic account linking is disabled for this provider.',
        );
      }
      try {
        await this.repo.createSocialAccount({
          userId: existingUser.id,
          provider,
          providerId: profile.providerId,
          email,
          name: profile.name,
        });
      } catch (err) {
        // P2002: 동시성 충돌 — 이미 다른 요청이 createSocialAccount 완료
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const raceResult = await this.repo.findByProviderAndProviderId(
            provider,
            profile.providerId,
          );
          if (raceResult) {
            return this.authService.issueTokensForUser(raceResult.user);
          }
        }
        throw err;
      }
      return this.authService.issueTokensForUser(existingUser);
    }

    // 3c. 신규 사용자 + 소셜 계정 순차 생성
    try {
      const newUser = await this.repo.createUser({
        email,
        name: profile.name,
        password: null,
      });
      await this.repo.createSocialAccount({
        userId: newUser.id,
        provider,
        providerId: profile.providerId,
        email,
        name: profile.name,
      });
      return this.authService.issueTokensForUser(newUser);
    } catch (err) {
      // P2002: 동시성 충돌 — 이미 다른 요청이 사용자·소셜계정 생성 완료
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const raceResult = await this.repo.findByProviderAndProviderId(
          provider,
          profile.providerId,
        );
        if (raceResult) {
          return this.authService.issueTokensForUser(raceResult.user);
        }
        if (!autoLinkAllowed) {
          // Naver: 동시성 경합으로 email 이 방금 다른 계정에 귀속된 경우에도
          // 자동 연동하지 않고 충돌로 응답한다(3b 와 동일 정책 — SEC-001).
          throw new ConflictException(
            'Email already registered. Automatic account linking is disabled for this provider.',
          );
        }
        const raceUser = await this.repo.findUserByEmail(email);
        if (raceUser) {
          return this.authService.issueTokensForUser(raceUser);
        }
      }
      throw err;
    }
  }
}
