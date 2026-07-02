import { Injectable, UnauthorizedException } from '@nestjs/common';
import { KakaoProvider } from './kakao.provider';
import { GoogleProvider } from './google.provider';
import { SocialProviderPort } from './social-provider.port';

/**
 * 제공자 문자열 → SocialProviderPort 구현체 매핑.
 *
 * Naver 는 이번 릴리즈에서 활성 provider 집합에서 제외되었다(SEC-001/GAP-014-08/GAP-014-10
 * — 네이버 오픈API가 app/client 바인딩 검증 수단을 제공하지 않아 재로그인 경로(path 3a)의
 * 계정 탈취를 코드로 차단할 수 없음). `NaverProvider` 구현체는 향후 authorization code +
 * client_secret 교환 방식(ADR-001 재검토) 도입 시 재와이어링을 전제로 파일은 보존한다.
 */
@Injectable()
export class SocialProviderResolver {
  private readonly providers: Record<string, SocialProviderPort>;

  constructor(
    private readonly kakao: KakaoProvider,
    private readonly google: GoogleProvider,
  ) {
    this.providers = {
      kakao: this.kakao,
      google: this.google,
    };
  }

  resolve(provider: string): SocialProviderPort {
    const impl = this.providers[provider];
    if (!impl) {
      throw new UnauthorizedException(`Unsupported social provider: ${provider}`);
    }
    return impl;
  }
}
