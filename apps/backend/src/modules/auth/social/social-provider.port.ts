/** 소셜 제공자로부터 받아온 프로필. email 은 제공자가 전달하지 않으면 null. */
export interface SocialProfile {
  providerId: string;
  email: string | null;
  name: string | null;
}

/**
 * 소셜 OAuth 토큰 검증 포트.
 * NestJS DI 토큰으로 사용하기 위해 abstract class 로 선언
 * (TypeScript interface 는 런타임에 소거되므로 DI 토큰으로 사용 불가).
 */
export abstract class SocialProviderPort {
  /**
   * 클라이언트 SDK 가 발급한 access/id token 을 검증하고 프로필을 반환한다.
   * @throws {UnauthorizedException} 토큰 검증 실패 또는 이메일 없음(FR-003)
   */
  abstract verify(token: string): Promise<SocialProfile>;
}
