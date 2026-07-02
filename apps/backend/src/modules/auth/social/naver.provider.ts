import { Injectable, UnauthorizedException } from '@nestjs/common';
import { SocialProfile, SocialProviderPort } from './social-provider.port';

/** Naver 사용자 프로필 API 응답 */
interface NaverProfileResponse {
  resultcode: string;
  message: string;
  response: {
    id: string;
    email?: string;
    name?: string;
  };
}

/**
 * 네이버 소셜 로그인 제공자 — 이번 릴리즈 미활성(SEC-001/GAP-014-08/GAP-014-10).
 * 클라이언트 SDK 가 발급한 accessToken 을 /v1/nid/me 에 전달해 프로필을 검증한다.
 *
 * [이번 릴리즈 제외 결정] 네이버 오픈API는 카카오의 access_token_info(app_id)나 구글의
 * tokeninfo(aud) 에 대응하는, 토큰이 어느 애플리케이션에 발급되었는지 식별하는 공개
 * 엔드포인트를 제공하지 않는다. 이 provider 는 타 애플리케이션이 발급한 access token 을
 * 구분할 방법이 없다(공격 시나리오는 security-report.md SEC-001 참조). FR-005 자동연동
 * 경로(path 3b/3c)만 차단하는 `AUTO_LINK_PROVIDERS` 화이트리스트로는 providerId 매칭
 * 재로그인 경로(path 3a)의 계정 탈취까지는 막지 못함이 재감사(GAP-014-10)로 확정되어,
 * 사용자 결정에 따라 Naver 를 이번 릴리즈의 활성 provider 집합에서 완전히 제외했다
 * (`SocialProviderResolver`·`SocialLoginDto` 화이트리스트 미포함 — 이 클래스는 module
 * providers/resolver 어디에도 와이어링되지 않아 실행 경로에서 도달 불가능하다).
 * 향후 authorization code + client_secret 교환 방식(ADR-001 재검토)으로 app/client
 * 바인딩 검증을 구현하면 이 provider 를 재도입할 수 있으며, 그 작업은 별도 spec으로
 * 분리한다. 재도입 전까지 이 파일은 참조용으로만 보존한다.
 */
@Injectable()
export class NaverProvider extends SocialProviderPort {
  async verify(token: string): Promise<SocialProfile> {
    const res = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new UnauthorizedException('Naver token verification failed');
    }

    const data = (await res.json()) as NaverProfileResponse;

    if (data.resultcode !== '00') {
      throw new UnauthorizedException(`Naver API error: ${data.message}`);
    }

    return {
      providerId: data.response.id,
      email: data.response.email ?? null,
      name: data.response.name ?? null,
    };
  }
}
