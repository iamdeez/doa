/**
 * JwtAuthGuard 단위 테스트 — [env:unit]
 *
 * 대상 SC: SC-020, SC-021
 * 검증 방법: NestJS TestingModule + supertest (실 DB 없이 minimal app)
 *
 * 테스트 접근:
 *   - 최소 NestJS 테스트 앱 구성:
 *     PassportModule + JwtModule (고정 secret) + JwtStrategy + JwtAuthGuard + 테스트 컨트롤러
 *   - [env:unit]: DB 없음. 실 JWT 서명 + passport-jwt 검증만 동작.
 *   - JwtStrategy.validate()는 payload를 그대로 반환(DB 조회 없음).
 *
 * 주의 (AUTHORING — TDD Red):
 *   - JwtAuthGuard, JwtStrategy 파일이 아직 미존재 → import error 발생 가능 (허용).
 *   - 프로덕션 코드 구현 후 이 테스트가 Green 됨.
 */

import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';

// 단위 테스트 전용 고정 secret (production secret 와 무관)
const TEST_ACCESS_SECRET = 'test-jwt-access-secret-for-guard-unit-tests';

// ─────────────────────────────────────────────
// 최소 테스트 컨트롤러 (보호 라우트 포함)
// ─────────────────────────────────────────────
@Controller('test-guard')
class TestGuardController {
  /**
   * JwtAuthGuard 가 적용된 보호 라우트.
   * 유효한 Access Token 없으면 401.
   */
  @Get('protected')
  @UseGuards(JwtAuthGuard)
  protected() {
    return { ok: true };
  }
}

// ─────────────────────────────────────────────
// 테스트 스위트
// ─────────────────────────────────────────────
describe('JwtAuthGuard — SC-020, SC-021', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({
          secret: TEST_ACCESS_SECRET,
          signOptions: { expiresIn: '15m' },
        }),
      ],
      controllers: [TestGuardController],
      providers: [
        JwtStrategy,
        {
          // JwtStrategy는 jwtConfig(registerAs('jwt',...)) 네임스페이스를 통해
          // configService.get('jwt.accessSecret')으로 secret을 조회 — flat env key가 아님
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'jwt.accessSecret') return TEST_ACCESS_SECRET;
              return null;
            },
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    jwtService = module.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  // ─────────────────────────────────────────────
  // SC-020: Authorization 헤더 없이 보호 라우트 → 401
  // ─────────────────────────────────────────────
  describe('SC-020: 토큰 부재 시 보호 라우트 → 401', () => {
    it('when_no_token_then_me_401', async () => {
      /**
       * SC-020 (FR-012/013 관련):
       * Authorization 헤더 없이 @UseGuards(JwtAuthGuard) 보호 라우트 요청 시 HTTP 401.
       * JwtAuthGuard extends AuthGuard('jwt') → passport-jwt → 토큰 부재 → 401.
       */
      return request(app.getHttpServer())
        .get('/test-guard/protected')
        .expect(401);
    });

    it('when_invalid_bearer_format_then_401', async () => {
      /**
       * SC-020 보조: 잘못된 Bearer 형식(빈 토큰) → 401.
       */
      return request(app.getHttpServer())
        .get('/test-guard/protected')
        .set('Authorization', 'Bearer ')
        .expect(401);
    });
  });

  // ─────────────────────────────────────────────
  // SC-021: 만료된 Access Token → 401
  // ─────────────────────────────────────────────
  describe('SC-021: 만료된 Access Token → 401', () => {
    it('when_expired_access_then_guard_401', async () => {
      /**
       * SC-021 (FR-013 관련):
       * JwtAuthGuard 적용 라우트에 이미 만료된 Access Token으로 요청 시 HTTP 401.
       * JwtStrategy: ignoreExpiration=false → 만료 토큰 자동 거부 → 401.
       *
       * 만료 토큰 생성: expiresIn=-1 (음수 초 = 이미 과거 만료)
       */
      const expiredToken = jwtService.sign(
        { sub: 'user-fixed-id', email: 'test@example.com' },
        { expiresIn: -1 },  // 이미 만료된 토큰
      );

      return request(app.getHttpServer())
        .get('/test-guard/protected')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    it('when_wrong_secret_token_then_guard_401', async () => {
      /**
       * SC-021 보조: 다른 secret으로 서명된 토큰 → 401.
       * (위조 토큰 시나리오)
       */
      // 다른 secret으로 서명
      const wrongSecretToken = jwtService.sign(
        { sub: 'user-id' },
        { secret: 'wrong-secret', expiresIn: '15m' },
      );

      return request(app.getHttpServer())
        .get('/test-guard/protected')
        .set('Authorization', `Bearer ${wrongSecretToken}`)
        .expect(401);
    });
  });
});
