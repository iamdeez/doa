/**
 * Test: SocialAuthService — SC-001~003, SC-005~008, SC-010 (v1.1.0/014 spec)
 *
 * TDD Red 상태: production 심볼 미구현. import resolution 오류는 허용(계약 검증).
 * production 구현 완료 후 이 파일이 PASS 상태로 전환된다.
 *
 * 계정 해석 우선순위(ADR-003):
 *   a. findByProviderAndProviderId 존재 → 재로그인 (SC-001)
 *   b. findUserByEmail 존재 → 자동연동 (SC-002)
 *   c. 신규 사용자 생성 (SC-003)
 *
 * SC-009(naver provider verify) — 범위 외: 사용자 결정으로 Naver 소셜 로그인을
 * 이번 릴리즈에서 완전 제외(SEC-001/GAP-014-10 — app-binding 검증 수단 부재로
 * 계정 탈취 잔존 위험 근본 해소 불가). 별도 spec에서 재검토.
 *
 * [§F 마이그레이션, v1.1.0/016 SC-011] SocialAuthService 생성자에 OAuthStateService
 * 4번째 인자가 추가되어 DI mock 을 등록한다. 이 파일은 kakao/google 만 다루며 해당
 * provider 는 state 분기 자체에 진입하지 않으므로(FR-006) mock 동작은 불필요하고
 * DI 해석용 provider 등록만 필요하다.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';

// TDD Red — 아래 모듈은 미생성. import 오류 허용(contract 검증).
// production 구현 시 경로 그대로 사용:
import { SocialAuthService } from './social-auth.service';
import { SocialProviderResolver } from './social/social-provider.resolver';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { OAuthStateService } from './social/oauth-state.service';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const FIXED_USER = {
  id: 'user-001',
  email: 'user@kakao.com',
  password: '$2b$10$hashedPassword',
  name: '홍길동',
};

const NEW_USER = {
  id: 'social-user-001',
  email: 'new@kakao.com',
  password: null,
  name: '신규유저',
};

const KAKAO_PROFILE = {
  providerId: '123456789',
  email: 'user@kakao.com',
  name: '홍길동',
};

const GOOGLE_PROFILE = {
  providerId: '1234567890',
  email: 'user@gmail.com',
  name: '홍길동',
};

const SOCIAL_ACCOUNT_WITH_USER = {
  id: 'sa-001',
  userId: FIXED_USER.id,
  provider: 'kakao',
  providerId: KAKAO_PROFILE.providerId,
  email: KAKAO_PROFILE.email,
  name: KAKAO_PROFILE.name,
  user: FIXED_USER,
};

const TOKEN_RESULT = { accessToken: 'access-token-mock', refreshToken: 'refresh-token-mock' };

// ─── Mock factories ──────────────────────────────────────────────────────────

const makeMockSocialProviderPort = () => ({ verify: jest.fn() });

const makeMockSocialProviderResolver = () => ({ resolve: jest.fn() });

const makeMockAuthRepository = () => ({
  findByProviderAndProviderId: jest.fn(),
  findUserByEmail: jest.fn(),
  createSocialAccount: jest.fn(),
  createUser: jest.fn(),
});

const makeMockAuthService = () => ({
  issueTokensForUser: jest.fn().mockResolvedValue(TOKEN_RESULT),
});
const makeMockOAuthStateService = () => ({
  issue: jest.fn(),
  consume: jest.fn(),
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SocialAuthService', () => {
  let service: SocialAuthService;
  let mockSocialProviderResolver: ReturnType<typeof makeMockSocialProviderResolver>;
  let mockSocialProviderPort: ReturnType<typeof makeMockSocialProviderPort>;
  let mockAuthRepository: ReturnType<typeof makeMockAuthRepository>;
  let mockAuthService: ReturnType<typeof makeMockAuthService>;
  let mockOAuthStateService: ReturnType<typeof makeMockOAuthStateService>;

  beforeEach(async () => {
    mockSocialProviderResolver = makeMockSocialProviderResolver();
    mockSocialProviderPort = makeMockSocialProviderPort();
    mockAuthRepository = makeMockAuthRepository();
    mockAuthService = makeMockAuthService();
    mockOAuthStateService = makeMockOAuthStateService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialAuthService,
        { provide: SocialProviderResolver, useValue: mockSocialProviderResolver },
        { provide: AuthRepository, useValue: mockAuthRepository },
        { provide: AuthService, useValue: mockAuthService },
        { provide: OAuthStateService, useValue: mockOAuthStateService },
      ],
    }).compile();

    service = module.get<SocialAuthService>(SocialAuthService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── SC-001 (FR-004): 기연동 소셜계정 재로그인 ────────────────────────────────
  it('test_SC001_existing_social_account_returns_tokens', async () => {
    /**
     * SC-001 (v1.1.0/014 spec): 이미 연동된 소셜 계정(동일 provider·providerId)으로
     * 소셜 로그인 API 요청 시 accessToken·refreshToken이 반환된다.
     *
     * PROC-003: a 경로 매칭 시 b/c(findUserByEmail, createUser) 미진입 검증.
     */
    mockSocialProviderResolver.resolve.mockReturnValue(mockSocialProviderPort);
    mockSocialProviderPort.verify.mockResolvedValue(KAKAO_PROFILE);
    mockAuthRepository.findByProviderAndProviderId.mockResolvedValue(SOCIAL_ACCOUNT_WITH_USER);

    const result = await service.login('kakao', 'valid-kakao-token');

    expect(result).toEqual(TOKEN_RESULT);
    expect(mockAuthService.issueTokensForUser).toHaveBeenCalledWith(FIXED_USER);

    // a 경로 매칭 → b/c 미진입(PROC-003)
    expect(mockAuthRepository.findUserByEmail).not.toHaveBeenCalled();
    expect(mockAuthRepository.createUser).not.toHaveBeenCalled();
    expect(mockAuthRepository.createSocialAccount).not.toHaveBeenCalled();
  });

  // ── SC-002 (FR-005): 이메일 일치 자동연동 ───────────────────────────────────
  it('test_SC002_auto_link_existing_email_returns_tokens', async () => {
    /**
     * SC-002 (v1.1.0/014 spec): 소셜 제공자 이메일이 기존 사용자 계정 이메일과
     * 동일하나 해당 소셜 계정이 미연동 상태일 때 로그인 요청 시, 기존 계정에
     * 소셜 계정이 연동되고 accessToken·refreshToken이 반환된다.
     *
     * PROC-003: b 경로 — findByProviderAndProviderId=null → findUserByEmail=FIXED_USER.
     * createUser 미호출 검증.
     */
    mockSocialProviderResolver.resolve.mockReturnValue(mockSocialProviderPort);
    mockSocialProviderPort.verify.mockResolvedValue(KAKAO_PROFILE);
    mockAuthRepository.findByProviderAndProviderId.mockResolvedValue(null);
    mockAuthRepository.findUserByEmail.mockResolvedValue(FIXED_USER);
    mockAuthRepository.createSocialAccount.mockResolvedValue({
      id: 'sa-new-001',
      userId: FIXED_USER.id,
      provider: 'kakao',
      providerId: KAKAO_PROFILE.providerId,
      email: KAKAO_PROFILE.email,
      name: KAKAO_PROFILE.name,
    });

    const result = await service.login('kakao', 'valid-kakao-token');

    expect(result).toEqual(TOKEN_RESULT);
    expect(mockAuthRepository.createSocialAccount).toHaveBeenCalledTimes(1);
    expect(mockAuthService.issueTokensForUser).toHaveBeenCalledWith(FIXED_USER);

    // b 경로 → c(createUser) 미호출(PROC-003)
    expect(mockAuthRepository.createUser).not.toHaveBeenCalled();
  });

  // ── SC-003 (FR-006): 신규 사용자 생성 + 토큰 ────────────────────────────────
  it('test_SC003_new_user_created_returns_tokens', async () => {
    /**
     * SC-003 (v1.1.0/014 spec): 소셜 이메일에 해당하는 기존 계정이 없을 때
     * 소셜 로그인 요청 시, 신규 사용자 계정이 생성되고 accessToken·refreshToken이 반환된다.
     *
     * PROC-003: c 경로 — findByProviderAndProviderId=null, findUserByEmail=null.
     */
    mockSocialProviderResolver.resolve.mockReturnValue(mockSocialProviderPort);
    mockSocialProviderPort.verify.mockResolvedValue({ ...KAKAO_PROFILE, email: NEW_USER.email });
    mockAuthRepository.findByProviderAndProviderId.mockResolvedValue(null);
    mockAuthRepository.findUserByEmail.mockResolvedValue(null);
    mockAuthRepository.createUser.mockResolvedValue(NEW_USER);
    mockAuthRepository.createSocialAccount.mockResolvedValue({
      id: 'sa-002',
      userId: NEW_USER.id,
      provider: 'kakao',
      providerId: KAKAO_PROFILE.providerId,
      email: NEW_USER.email,
      name: NEW_USER.name,
    });

    const result = await service.login('kakao', 'valid-kakao-token');

    expect(result).toEqual(TOKEN_RESULT);
    expect(mockAuthRepository.createUser).toHaveBeenCalledTimes(1);
    expect(mockAuthRepository.createSocialAccount).toHaveBeenCalledTimes(1);
    expect(mockAuthService.issueTokensForUser).toHaveBeenCalledWith(NEW_USER);
  });

  // ── SC-005 (FR-003): email null → 400 거부 ──────────────────────────────────
  it('test_SC005_email_null_returns_400', async () => {
    /**
     * SC-005 (v1.1.0/014 spec): 소셜 제공자로부터 이메일이 반환되지 않는 응답을
     * stub으로 시뮬레이션할 때 소셜 로그인 요청이 4xx 오류로 거부된다.
     */
    mockSocialProviderResolver.resolve.mockReturnValue(mockSocialProviderPort);
    mockSocialProviderPort.verify.mockResolvedValue({
      providerId: '999',
      email: null,
      name: null,
    });

    await expect(service.login('kakao', 'valid-token-no-email')).rejects.toThrow(
      BadRequestException,
    );

    // email null → 계정 조회·생성 미진입
    expect(mockAuthRepository.findByProviderAndProviderId).not.toHaveBeenCalled();
  });

  // ── SC-006 (FR-002): 무효 토큰 → 4xx ──────────────────────────────────────
  it('test_SC006_invalid_token_returns_4xx', async () => {
    /**
     * SC-006 (v1.1.0/014 spec): 유효하지 않은 토큰으로 소셜 로그인 요청 시
     * 4xx 오류가 반환된다.
     */
    mockSocialProviderResolver.resolve.mockReturnValue(mockSocialProviderPort);
    mockSocialProviderPort.verify.mockRejectedValue(new BadRequestException('Invalid token'));

    await expect(service.login('kakao', 'invalid-token')).rejects.toThrow();

    // verify 실패 → 계정 조회·생성 미진입
    expect(mockAuthRepository.findByProviderAndProviderId).not.toHaveBeenCalled();
  });

  // ── SC-007 (FR-001,002): kakao 제공자 경로 수행 + JWT ───────────────────────
  it('test_SC007_kakao_provider_verify_path_returns_jwt', async () => {
    /**
     * SC-007 (v1.1.0/014 spec): `provider: 'kakao'` 식별자로 소셜 로그인 요청 시
     * 카카오 검증 흐름이 수행되고 JWT가 반환된다.
     */
    const kakaoPort = makeMockSocialProviderPort();
    kakaoPort.verify.mockResolvedValue(KAKAO_PROFILE);
    mockSocialProviderResolver.resolve.mockReturnValue(kakaoPort);
    mockAuthRepository.findByProviderAndProviderId.mockResolvedValue(SOCIAL_ACCOUNT_WITH_USER);

    const result = await service.login('kakao', 'kakao-token');

    expect(mockSocialProviderResolver.resolve).toHaveBeenCalledWith('kakao');
    expect(kakaoPort.verify).toHaveBeenCalledWith('kakao-token');
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
  });

  // ── SC-008 (FR-001,002): google 제공자 경로 수행 + JWT ──────────────────────
  it('test_SC008_google_provider_verify_path_returns_jwt', async () => {
    /**
     * SC-008 (v1.1.0/014 spec): `provider: 'google'` 식별자로 소셜 로그인 요청 시
     * 구글 검증 흐름이 수행되고 JWT가 반환된다.
     */
    const googlePort = makeMockSocialProviderPort();
    googlePort.verify.mockResolvedValue(GOOGLE_PROFILE);
    mockSocialProviderResolver.resolve.mockReturnValue(googlePort);
    const googleUserWithAccount = {
      ...SOCIAL_ACCOUNT_WITH_USER,
      provider: 'google',
      providerId: GOOGLE_PROFILE.providerId,
      email: GOOGLE_PROFILE.email,
    };
    mockAuthRepository.findByProviderAndProviderId.mockResolvedValue(googleUserWithAccount);

    const result = await service.login('google', 'google-id-token');

    expect(mockSocialProviderResolver.resolve).toHaveBeenCalledWith('google');
    expect(googlePort.verify).toHaveBeenCalledWith('google-id-token');
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
  });

  // ── SC-010 (FR-009): social_accounts 레코드 생성 — 인자 검증 ──────────────
  it('test_SC010_create_social_account_called_with_correct_args', async () => {
    /**
     * SC-010 (v1.1.0/014 spec): 소셜 로그인 성공 후 social_accounts 테이블에
     * 해당 provider·providerId·email·name 레코드가 존재한다.
     *
     * 검증: c 경로(신규 사용자) — createSocialAccount 호출 인자로 레코드 생성 확인.
     * (PROC-004 canonical 시그니처: createSocialAccount({userId, provider, providerId, email, name}))
     */
    const newUserProfile = { providerId: '444', email: 'new-sc010@kakao.com', name: '테스트유저' };
    const createdUser = { id: 'user-sc010', email: newUserProfile.email, password: null, name: newUserProfile.name };

    mockSocialProviderResolver.resolve.mockReturnValue(mockSocialProviderPort);
    mockSocialProviderPort.verify.mockResolvedValue(newUserProfile);
    mockAuthRepository.findByProviderAndProviderId.mockResolvedValue(null);
    mockAuthRepository.findUserByEmail.mockResolvedValue(null);
    mockAuthRepository.createUser.mockResolvedValue(createdUser);
    mockAuthRepository.createSocialAccount.mockResolvedValue({
      id: 'sa-sc010',
      userId: createdUser.id,
      provider: 'kakao',
      ...newUserProfile,
    });

    await service.login('kakao', 'token-for-sc010');

    expect(mockAuthRepository.createSocialAccount).toHaveBeenCalledWith({
      userId: createdUser.id,
      provider: 'kakao',
      providerId: newUserProfile.providerId,
      email: newUserProfile.email,
      name: newUserProfile.name,
    });
  });
});
