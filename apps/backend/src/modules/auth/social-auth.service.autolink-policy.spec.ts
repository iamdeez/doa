/**
 * Regression test: SocialAuthService — AUTO_LINK_PROVIDERS 화이트리스트 방어적 정책
 * (SEC-001/GAP-014-08/GAP-014-10).
 * SC-XXX 매핑 없음 (5a Test Agent 책임 범위 외 — Development Agent 보안 회귀 테스트).
 *
 * Naver 는 이번 릴리즈에서 `SocialProviderResolver`/`SocialLoginDto` 화이트리스트에서
 * 완전히 제외되어(GAP-014-10) 실제 API 경로로는 이 서비스에 도달할 수 없다. 아래
 * 'naver' 케이스는 provider 문자열을 직접 호출하는 방식으로 AUTO_LINK_PROVIDERS 의
 * 방어적 심층 방어(defense-in-depth) 동작 — 화이트리스트에 없는 provider 는 이메일이
 * 기존 계정과 일치해도 자동 연동하지 않고 409 Conflict 로 거부 — 을 검증한다.
 * Kakao/Google 은 기존 자동연동 동작을 그대로 유지한다(회귀 0).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { SocialAuthService } from './social-auth.service';
import { SocialProviderResolver } from './social/social-provider.resolver';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';

const EXISTING_USER = {
  id: 'user-existing-001',
  email: 'shared@example.com',
  password: '$2b$10$hashedPassword',
  name: '기존유저',
};

const NEW_USER = {
  id: 'social-user-naver-001',
  email: 'brand-new@example.com',
  password: null,
  name: '네이버신규유저',
};

const TOKEN_RESULT = { accessToken: 'access-token-mock', refreshToken: 'refresh-token-mock' };

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

describe('SocialAuthService — SEC-001/GAP-014-08 auto-link policy', () => {
  let service: SocialAuthService;
  let mockResolver: ReturnType<typeof makeMockSocialProviderResolver>;
  let mockPort: ReturnType<typeof makeMockSocialProviderPort>;
  let mockRepo: ReturnType<typeof makeMockAuthRepository>;
  let mockAuthService: ReturnType<typeof makeMockAuthService>;

  beforeEach(async () => {
    mockResolver = makeMockSocialProviderResolver();
    mockPort = makeMockSocialProviderPort();
    mockRepo = makeMockAuthRepository();
    mockAuthService = makeMockAuthService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialAuthService,
        { provide: SocialProviderResolver, useValue: mockResolver },
        { provide: AuthRepository, useValue: mockRepo },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    service = module.get<SocialAuthService>(SocialAuthService);
  });

  afterEach(() => jest.clearAllMocks());

  it('naver 로그인 시 동일 이메일의 기존 계정이 있어도 자동 연동하지 않고 Conflict 로 거부한다', async () => {
    mockResolver.resolve.mockReturnValue(mockPort);
    mockPort.verify.mockResolvedValue({
      providerId: 'naver-999',
      email: EXISTING_USER.email,
      name: '네이버유저',
    });
    mockRepo.findByProviderAndProviderId.mockResolvedValue(null);
    mockRepo.findUserByEmail.mockResolvedValue(EXISTING_USER);

    await expect(service.login('naver', 'naver-token')).rejects.toThrow(ConflictException);

    expect(mockRepo.createSocialAccount).not.toHaveBeenCalled();
    expect(mockRepo.createUser).not.toHaveBeenCalled();
    expect(mockAuthService.issueTokensForUser).not.toHaveBeenCalled();
  });

  it('naver 로그인 시 겹치는 계정이 없으면 독립 신규 계정으로 정상 생성된다 (path 3c 회귀 없음)', async () => {
    mockResolver.resolve.mockReturnValue(mockPort);
    mockPort.verify.mockResolvedValue({
      providerId: 'naver-111',
      email: NEW_USER.email,
      name: NEW_USER.name,
    });
    mockRepo.findByProviderAndProviderId.mockResolvedValue(null);
    mockRepo.findUserByEmail.mockResolvedValue(null);
    mockRepo.createUser.mockResolvedValue(NEW_USER);
    mockRepo.createSocialAccount.mockResolvedValue({
      id: 'sa-naver-new',
      userId: NEW_USER.id,
      provider: 'naver',
      providerId: 'naver-111',
      email: NEW_USER.email,
      name: NEW_USER.name,
    });

    const result = await service.login('naver', 'naver-token-new');

    expect(result).toEqual(TOKEN_RESULT);
    expect(mockRepo.createUser).toHaveBeenCalledTimes(1);
    expect(mockRepo.createSocialAccount).toHaveBeenCalledTimes(1);
    expect(mockAuthService.issueTokensForUser).toHaveBeenCalledWith(NEW_USER);
  });

  it.each(['kakao', 'google'])(
    '%s 로그인은 동일 이메일의 기존 계정에 자동 연동을 계속 허용한다 (회귀 없음)',
    async (provider) => {
      mockResolver.resolve.mockReturnValue(mockPort);
      mockPort.verify.mockResolvedValue({
        providerId: `${provider}-777`,
        email: EXISTING_USER.email,
        name: '연동유저',
      });
      mockRepo.findByProviderAndProviderId.mockResolvedValue(null);
      mockRepo.findUserByEmail.mockResolvedValue(EXISTING_USER);
      mockRepo.createSocialAccount.mockResolvedValue({
        id: `sa-${provider}-777`,
        userId: EXISTING_USER.id,
        provider,
        providerId: `${provider}-777`,
        email: EXISTING_USER.email,
        name: '연동유저',
      });

      const result = await service.login(provider, `${provider}-token`);

      expect(result).toEqual(TOKEN_RESULT);
      expect(mockRepo.createSocialAccount).toHaveBeenCalledTimes(1);
      expect(mockAuthService.issueTokensForUser).toHaveBeenCalledWith(EXISTING_USER);
    },
  );
});
