---
작성: Security Agent
버전: v1.0
최종 수정: 2026-06-28 16:40
상태: 확정
---

# 보안 감사 결과 — 001-skeleton-bootstrap

## 목차

- [검토 범위](#검토-범위)
- [요약](#요약)
- [Constitution 보안 조항 이행 현황](#constitution-보안-조항-이행-현황)
- [취약점 목록](#취약점-목록)
- [NFR / SC 보안 요구사항 이행 현황](#nfr--sc-보안-요구사항-이행-현황)
- [OWASP Top 10 검토 결과](#owasp-top-10-검토-결과)
- [권고사항](#권고사항)

---

## 검토 범위

### 검토 대상 파일

> DIFF 파일 미존재 (git 미초기화) → 신규 파일 목록 기반 검토. auth 보안 경계 파일 전체 포함.

| 파일 | 검토 이유 |
|---|---|
| `apps/backend/src/modules/auth/auth.service.ts` | 핵심 — bcrypt 해싱, SHA-256 refresh 해시, JWT 발급·검증 |
| `apps/backend/src/modules/auth/auth.controller.ts` | 인증 API 라우트, 가드 적용 여부 |
| `apps/backend/src/modules/auth/auth.repository.ts` | DB 접근 계층, SQL 인젝션 방어 |
| `apps/backend/src/modules/auth/dto/register.dto.ts` | 입력 검증 — 이메일·비밀번호 형식 |
| `apps/backend/src/modules/auth/dto/login.dto.ts` | 입력 검증 |
| `apps/backend/src/modules/auth/dto/refresh.dto.ts` | 입력 검증 |
| `apps/backend/src/shared/auth/jwt.strategy.ts` | JWT 검증 전략, `ignoreExpiration` 설정 |
| `apps/backend/src/shared/auth/jwt-auth.guard.ts` | 인증 가드 구현 |
| `apps/backend/src/shared/auth/current-user.decorator.ts` | 인증 사용자 컨텍스트 추출 |
| `apps/backend/src/shared/config/jwt.config.ts` | JWT 시크릿 환경변수 주입, 시작 시 유효성 검증 |
| `apps/backend/prisma/schema.prisma` | DB 스키마 — password·tokenHash 컬럼 정의 |
| `apps/backend/src/main.ts` | 전역 ValidationPipe, CORS·보안 헤더 설정 여부 |

### 제외 파일 및 사유

| 제외 파일 | 사유 |
|---|---|
| `apps/backend/src/modules/user,seller,product,...` (17개 스텁) | 빈 골격 파일 — 비즈니스 로직 없음. Task 지시에 따라 제외 |
| `apps/backend/test/`, `*.spec.ts` | 테스트 코드 — 프로덕션 실행 경로 아님 |
| `.github/workflows/ci.yml` | CI 구성 — Deploy Agent 검토 완료 |

---

## 요약

| 항목 | 결과 |
|---|---|
| 검토 대상 파일 수 | 12개 |
| Critical 취약점 | **0건** |
| High 취약점 | **0건** |
| Medium 취약점 | **4건** (SEC-001, SEC-002, SEC-003, SEC-004) |
| Low 취약점 | **5건** (SEC-005, SEC-006, SEC-007, SEC-008, SEC-009) |
| 전체 취약점 | **9건** |
| 판정 | **COMPLETE** (Critical/High 0건 — Medium 이하 권고사항 기록) |

---

## Constitution 보안 조항 이행 현황

constitution.md에 명시적 보안 조항은 없으나, 각 원칙이 보안에 미치는 영향을 확인한다.

| 조항 | 관련 보안 항목 | 이행 여부 | 비고 |
|---|---|---|---|
| P-001. 모듈 경계 원칙 | auth 모듈이 users 스키마에만 접근 | 이행 | `auth.repository.ts` — `users.users`, `users.refresh_tokens`만 접근. 타 스키마 미접근 확인 |
| P-003. 단일 DB 원칙 | 인-앱 저장소 사용 (외부 세션 스토어 없음) | 이행 | PostgreSQL 단일 인스턴스, refresh_tokens 테이블로 상태 관리 |
| P-005. 결제·정산 정합성 원칙 | 결제·환불·정산 흐름 | 해당 없음 | Stage 1 인증 골격 범위. 결제 모듈 빈 스텁 |
| P-006. 테스트 원칙 | 보안 수용 기준(SC-010~SC-021) 테스트 | 이행 | SC-010~021 전수 테스트 보유, 32/32 PASS 확인 |

---

## 취약점 목록

### SEC-001 (Medium) — JWT 시크릿 최소 길이 미검증

| 항목 | 내용 |
|---|---|
| 심각도 | Medium |
| OWASP | A02 암호화 실패 |
| 위치 | `apps/backend/src/shared/config/jwt.config.ts` L10–19 |
| 설명 | `jwt.config.ts`는 `JWT_ACCESS_SECRET`·`JWT_REFRESH_SECRET`의 존재 여부만 검증한다(`if (!accessSecret) throw Error(...)`). 값이 빈 문자열이 아닌 이상 짧은 시크릿(예: `"a"`)도 시작을 허용한다. 짧거나 추측 가능한 시크릿은 JWT 위조 공격으로 이어질 수 있다. |
| 수정 방향 | `jwt.config.ts`에 최소 길이 검증 추가 — `accessSecret.length < 32`이면 시작 거부(throw). 32바이트(256비트) 이상 권장. 운영 환경에서는 64자 이상 랜덤 hex 시크릿 사용 권고(`.env.example` 주석 보강). |
| 상태 | OPEN |

### SEC-002 (Medium) — Rate Limiting 미적용

| 항목 | 내용 |
|---|---|
| 심각도 | Medium |
| OWASP | A07 인증 및 세션 관리, A04 안전하지 않은 설계 |
| 위치 | `apps/backend/src/modules/auth/auth.controller.ts` — 모든 엔드포인트, `apps/backend/src/main.ts` |
| 설명 | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh` 엔드포인트에 rate limiting이 없다. 무제한 요청으로 비밀번호 브루트포스·계정 열거·서비스 부하 공격이 가능하다. plan.md §인터페이스 계약에 "타이밍 공격 완화는 Stage 2+ 검토"로 명시되어 있어 범위 인식은 존재하지만, rate limiting 미적용은 인증 엔드포인트의 핵심 보안 위험이다. |
| 수정 방향 | `@nestjs/throttler`를 전역 또는 auth 컨트롤러에 적용. 로그인 엔드포인트: 동일 IP 기준 분당 10회 이하. 회원가입: 분당 5회 이하. 다음 spec에서 처리 권장. |
| 상태 | OPEN |

### SEC-003 (Medium) — HTTP 보안 헤더 (helmet) 미적용

| 항목 | 내용 |
|---|---|
| 심각도 | Medium |
| OWASP | A05 보안 설정 오류 |
| 위치 | `apps/backend/src/main.ts` |
| 설명 | `main.ts`에 `helmet()` 미적용. NestJS는 기본적으로 `X-Powered-By`, `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy` 등 보안 헤더를 설정하지 않는다. 이로 인해 기술 스택 노출(`X-Powered-By: Express`), Clickjacking, MIME sniffing 등의 위험이 존재한다. |
| 수정 방향 | `app.use(helmet())` 적용 (`@nestjs/helmet` 또는 `helmet` 패키지). 운영 배포 전 필수. 다음 spec에서 처리 권장. |
| 상태 | OPEN |

### SEC-004 (Medium) — 인증 실패 이벤트 보안 로그 미구현

| 항목 | 내용 |
|---|---|
| 심각도 | Medium |
| OWASP | A09 로깅·모니터링 |
| 위치 | `apps/backend/src/modules/auth/auth.service.ts` — `login()`, `refresh()` |
| 설명 | 인증 실패(`UnauthorizedException` throw)가 발생할 때 pino HTTP 로그가 401 응답을 기록하지만, 실패한 이메일·IP·실패 유형(비밀번호 불일치/사용자 없음/토큰 만료 등)을 명시적으로 기록하지 않는다. 보안 모니터링·침해 탐지·이상 패턴 감지에 필수적인 정보가 누락된다. |
| 수정 방향 | `auth.service.ts`의 인증 실패 분기에 `this.logger.warn({ email, reason: '...' }, 'Auth failure')` 형태의 구조적 로그 추가. pino 로그에 포함되어 SIEM·모니터링과 연동 가능. 다음 spec에서 처리 권장. |
| 상태 | OPEN |

### SEC-005 (Low) — 이메일 열거 가능 (register 409)

| 항목 | 내용 |
|---|---|
| 심각도 | Low |
| OWASP | A07 인증 및 세션 관리 |
| 위치 | `apps/backend/src/modules/auth/auth.service.ts` `register()` |
| 설명 | `POST /auth/register`에서 이미 가입된 이메일로 요청 시 HTTP 409 + `"Email already exists"` 메시지를 반환한다. 공격자가 이메일 존재 여부를 체계적으로 확인할 수 있다. 단, 이는 register 엔드포인트의 일반적 패턴이며 SC-010 수용 기준으로 명시된 동작이다. |
| 수정 방향 | 수용 기준(SC-010) 범위이므로 당장 변경 불필요. 단, 향후 개인정보 보호 요건 강화 시 "이미 가입된 이메일로 인증 메일을 발송했습니다" 패턴(계정 존재 미공개)으로 전환 고려. |
| 상태 | OPEN (Low 권고) |

### SEC-006 (Low) — logout 시 refreshToken JWT 서명 미검증

| 항목 | 내용 |
|---|---|
| 심각도 | Low |
| OWASP | A07 인증 및 세션 관리 |
| 위치 | `apps/backend/src/modules/auth/auth.service.ts` `logout()` |
| 설명 | `logout()`은 제출된 `refreshToken`을 JWT 서명·만료 검증 없이 SHA-256 해싱하여 DB row를 `revoked=true`로 업데이트한다. 임의 문자열로 logout 요청 시, 해당 hash에 매칭되는 DB row가 없어도 `revokeRefreshToken`이 `updateMany`(0건 갱신)로 처리되며, 실질적 데이터 손상은 없다. plan.md §인터페이스 계약에서 의도적으로 가드를 제외한 설계 결정이다. |
| 수정 방향 | 현재 설계 결정(plan.md ADR, GAP-002 해결 근거) 유지 허용. 필요 시 `jwtService.verify(refreshToken)` 먼저 수행 후 실패 시 silently 무시(logout은 멱등 처리가 일반적). |
| 상태 | OPEN (Low 권고, 현재 설계 허용 범위) |

### SEC-007 (Low) — 비밀번호 복잡도 최소 요구사항 부재

| 항목 | 내용 |
|---|---|
| 심각도 | Low |
| OWASP | A07 인증 및 세션 관리 |
| 위치 | `apps/backend/src/modules/auth/dto/register.dto.ts` |
| 설명 | `@MinLength(8)` 만 적용. 대문자·숫자·특수문자 조합 강제 없음. 8자 단순 문자열(예: `aaaaaaaa`)로 계정 생성 가능. |
| 수정 방향 | `@Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, { message: '...' })` 또는 `@MinLength(10)` 등으로 강화. spec NFR-005가 "단방향 해싱·원문 미저장"만 요구하므로 이는 scope 외지만 보안 강화 권고. |
| 상태 | OPEN (Low 권고) |

### SEC-008 (Low) — 사용자별 활성 refresh 토큰 수 무제한

| 항목 | 내용 |
|---|---|
| 심각도 | Low |
| OWASP | A04 안전하지 않은 설계 |
| 위치 | `apps/backend/src/modules/auth/auth.service.ts` `login()`, `apps/backend/src/modules/auth/auth.repository.ts` |
| 설명 | 동일 사용자가 여러 번 로그인하면 `refresh_tokens` 테이블에 활성 토큰 row가 무제한 누적된다(만료 또는 revoke되지 않은 한). 30일 만료 TTL이 있어 자동 정리되지 않으면 테이블이 증가한다. 또한 refresh token 탈취 탐지(Refresh Token Rotation) 없다. |
| 수정 방향 | 로그인 시 해당 userId의 기존 활성 토큰을 일괄 revoke하거나 최대 N개 보존 정책 적용. 또는 주기적 만료 토큰 삭제 잡 구현. Refresh Token Rotation(재발급 시 이전 토큰 무효화) 고려. Stage 2+에서 처리 권장. |
| 상태 | OPEN (Low 권고) |

### SEC-009 (Low) — refresh 검증 시 토큰 소유권(userId) 미확인

| 항목 | 내용 |
|---|---|
| 심각도 | Low |
| OWASP | A01 접근 제어 |
| 위치 | `apps/backend/src/modules/auth/auth.service.ts` `refresh()` L144 |
| 설명 | `refresh()` 메서드는 DB에서 `tokenHash`로 RefreshToken row를 조회한 후 `stored.userId`와 JWT payload의 `sub`(userId)가 일치하는지 검증하지 않는다. SHA-256 해시 충돌 가능성은 1/2^256으로 실질적으로 불가능하므로 현재 운영 환경에서 실질 위험은 극히 낮다. 단, 방어적 코드 관점에서 명시적 소유권 검증이 누락되어 있다. |
| 수정 방향 | `if (stored.userId !== payload.sub) throw new UnauthorizedException(...)` 추가. 방어적 프로그래밍 관점에서 명시적 소유권 확인 권장. |
| 상태 | OPEN (Low 권고) |

---

## NFR / SC 보안 요구사항 이행 현황

| ID | 요구사항 | 이행 여부 | 검증 근거 |
|---|---|---|---|
| NFR-005 | 사용자 비밀번호 단방향 해싱 저장, 원문 미저장 | **이행** | `auth.service.ts` L65: `bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS)`. `schema.prisma` L22 주석: "password는 bcrypt 해시값만 저장 (NFR-005)". SC-011 integration 검증 PASS |
| NFR-003 | Access Token 유효 기간 15분(900초) | **이행** | `jwt.config.ts` L4: `JWT_ACCESS_TTL_SECONDS = 900`. `auth.service.ts` L96: `expiresIn: JWT_ACCESS_TTL_SECONDS`. SC-014 단위 테스트 PASS |
| NFR-004 | Refresh Token 유효 기간 30일 | **이행** | `jwt.config.ts` L7: `JWT_REFRESH_TTL_DAYS = 30`. `auth.service.ts` L103: `refreshTtlSeconds = JWT_REFRESH_TTL_DAYS * 24 * 60 * 60`. SC-017 단위 테스트 PASS |
| FR-008 | 비밀번호 단방향 해싱 저장, 중복 이메일 오류 | **이행** | `bcrypt.hash`, `ConflictException` (SC-009·SC-010 PASS) |
| FR-010 | 만료·무효화 Refresh Token 오류 처리 | **이행** | JWT 서명·exp 검증 + `revoked` flag + `expiresAt` 이중 검증 (SC-016 PASS) |
| FR-011 | 로그아웃 시 Refresh Token 무효화 | **이행** | `revokeRefreshToken(tokenHash)` — `revoked=true` (SC-018 PASS) |
| FR-013 | JWT 인증 가드 | **이행** | `JwtAuthGuard extends AuthGuard('jwt')`, `ignoreExpiration: false` (SC-020·SC-021 PASS) |
| ADR-001 | bcrypt cost 10~12 | **이행** (cost 10 선택) | `BCRYPT_SALT_ROUNDS = 10`. cost 12: P95=859ms > NFR-002 위반 → 10으로 조정(GAP-003 해결). cost 10: ADR-001 허용 범위 내, P95≈139ms |
| ADR-003 | Refresh Token SHA-256 해시 저장, 원문 미저장 | **이행** | `auth.service.ts` L111: `createHash('sha256').update(token).digest('hex')`. `schema.prisma` L31 주석: "DB에는 SHA-256 해시만 저장 (ADR-003)". `tokenHash @unique` 인덱스로 결정적 조회 |

---

## OWASP Top 10 검토 결과

| OWASP | 카테고리 | 검토 결과 | 관련 SEC-ID |
|---|---|---|---|
| A01 | 접근 제어 취약점 | 양호. `JwtAuthGuard` 만료·서명 검증 ✓. logout 가드 제외는 설계 의도 ✓. tokenHash 소유권 미확인(Low) | SEC-009 |
| A02 | 암호화 실패 | 양호. bcrypt cost 10 ✓. SHA-256 refresh 해시 ✓. 분리된 access/refresh 시크릿 ✓. 시크릿 최소 길이 미검증(Medium) | SEC-001 |
| A03 | 인젝션 | 양호. Prisma ORM 파라미터화 쿼리 ✓. `ValidationPipe({whitelist, forbidNonWhitelisted})` 전역 적용 ✓. SQL 인젝션 위험 없음 | 해당 없음 |
| A04 | 안전하지 않은 설계 | 주의. Rate Limiting 미적용(Medium). 토큰 수 무제한(Low) | SEC-002, SEC-008 |
| A05 | 보안 설정 오류 | 주의. helmet 미적용(Medium). CORS 명시적 설정 없음(Info — API only). `ValidationPipe` 전역 적용 ✓ | SEC-003 |
| A06 | 취약한 컴포넌트 | 양호. 핀 버전 사용(bcrypt 6.0.0, passport-jwt 4.0.1 — research.md 확인). 명시적 취약점 CVE 미발견 | 해당 없음 |
| A07 | 인증 및 세션 관리 | 주의. Rate Limiting 없음(Medium). 인증 실패 로그 없음(Medium). 이메일 열거(Low). logout 서명 미검증(Low). 비밀번호 복잡도(Low) | SEC-002, SEC-004, SEC-005, SEC-006, SEC-007 |
| A08 | 소프트웨어 무결성 | 양호. `pnpm-lock.yaml` 의존성 잠금 ✓. Prisma client 생성 빌드 프로세스 ✓ | 해당 없음 |
| A09 | 로깅·모니터링 | 주의. pino 구조적 HTTP 로그 ✓. 인증 실패 명시적 보안 이벤트 로그 없음(Medium) | SEC-004 |
| A10 | SSRF | 해당 없음. auth 모듈 내 외부 URL 요청 없음 ✓ | 해당 없음 |

---

## 권고사항

### 우선순위 High (다음 spec에서 처리 강력 권고)

1. **SEC-002 Rate Limiting**: `POST /auth/login`, `/register`, `/refresh`에 `@nestjs/throttler` 적용. 브루트포스 공격의 직접적 위험.
2. **SEC-003 helmet**: `main.ts`에 `app.use(helmet())` 추가. HTTP 보안 헤더 부재로 기술 스택 노출·Clickjacking 위험.

### 우선순위 Medium (Stage 2 초기에 처리 권고)

3. **SEC-001 JWT 시크릿 길이 검증**: `jwt.config.ts`에 `accessSecret.length < 32` 검증 추가.
4. **SEC-004 인증 실패 로그**: `auth.service.ts` 실패 분기에 `logger.warn()` 구조적 로그 추가.
5. **SEC-009 refresh 소유권 확인**: `stored.userId !== payload.sub` 방어 코드 추가.

### 우선순위 Low (Stage 3+ 또는 운영 안정화 후)

6. **SEC-008 refresh 토큰 수 제한**: 로그인 시 이전 활성 토큰 revoke 또는 Refresh Token Rotation 도입.
7. **SEC-005~007**: 이메일 열거 완화, logout 유효성 검증, 비밀번호 복잡도 강화.
