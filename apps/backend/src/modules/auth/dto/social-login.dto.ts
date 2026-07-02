import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

// Naver 는 이번 릴리즈에서 제외(SEC-001/GAP-014-08/GAP-014-10 — app/client 바인딩
// 검증 수단 부재로 재로그인 경로 계정 탈취를 차단할 수 없음). naver 요청은 400 으로 거부된다.
const SUPPORTED_PROVIDERS = ['kakao', 'google'] as const;

export class SocialLoginDto {
  @ApiProperty({ enum: SUPPORTED_PROVIDERS, description: '소셜 로그인 제공자' })
  @IsIn(SUPPORTED_PROVIDERS)
  provider!: string;

  @ApiProperty({ description: '클라이언트 SDK 가 발급한 access token 또는 id token' })
  @IsString()
  token!: string;
}
