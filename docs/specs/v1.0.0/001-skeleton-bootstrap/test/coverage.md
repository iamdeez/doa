---
작성: Test Agent (EXECUTION)
버전: v1.1
최종 수정: 2026-06-28 12:01
상태: 확정
---

# Coverage: 001-skeleton-bootstrap

## 목차

- [SC 커버리지 매트릭스](#sc-커버리지-매트릭스)
- [STALE_SC 경고](#stale_sc-경고)

---

## SC 커버리지 매트릭스

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | plan.md 시나리오 전체 | 상태 |
|---|---|---|---|---|---|---|
| SC-001 | Turborepo + pnpm 모노레포 구조 | ✓ 디렉토리·설정 파일 정적 검증 | — | — | ✓ | PASS |
| SC-002 | NestJS 기동 + pino stdout 로그 | ✓ AppModule 기동 검증 | — | — | ✓ | PASS |
| SC-003 | NestJS 애플리케이션 골격 | ✓ src/ 구조 파일 정적 검증 | — | — | ✓ | PASS |
| SC-004 | Prisma multiSchema 스키마 파일 | ✓ schema.prisma 8개 스키마 정적 검증 | — | — | ✓ | PASS |
| SC-005 | 17개 도메인 모듈 4계층 골격 | ✓ 모듈 디렉토리 구조 정적 검증 | — | — | ✓ | PASS |
| SC-006 | prisma migrate dev — 8스키마 2테이블 | ✓ 실제 마이그레이션 후 DB 조회 | — | — | ✓ | PASS |
| SC-007 | GET /health → 200 {status:"ok"} | ✓ 실 앱 기동 후 supertest | — | — | ✓ | PASS |
| SC-008 | GET /health P95 ≤ 200ms | — | ✓ 50회 연속 P95 측정 | — | ✓ | PASS |
| SC-009 | POST /auth/register → 201 {id,email} | ✓ 신규 사용자 등록 성공 | — | — | ✓ | PASS |
| SC-010 | 중복 이메일 register → 409 | — | — | ✓ 409 ConflictException | ✓ | PASS |
| SC-011 | register → DB 비밀번호 bcrypt 해시 저장 | ✓ DB 조회로 hash 확인 | — | — | ✓ | PASS |
| SC-012 | POST /auth/login → 200 {accessToken,refreshToken} | ✓ JWT 3-part 구조 확인 | — | — | ✓ | PASS |
| SC-013 | 존재하지 않는 이메일 login → 401 | — | — | ✓ 401 UnauthorizedException | ✓ | PASS |
| SC-014 | 잘못된 비밀번호 login → 401 | — | — | ✓ 401 UnauthorizedException | ✓ | PASS |
| SC-015 | POST /auth/refresh → 200 {accessToken} | ✓ 새 accessToken 발급 | — | — | ✓ | PASS |
| SC-016 | 만료·서명 무효 refresh → 401 | — | — | ✓ 401 UnauthorizedException | ✓ | PASS |
| SC-017 | revoked refresh → 401 | — | ✓ revoked=true DB 상태 경계 | — | ✓ | PASS |
| SC-018 | logout 후 동일 refresh → 401 | — | — | ✓ 204 logout 후 401 확인 | ✓ | **PASS** |
| SC-019 | GET /auth/me → 200 {id,email,createdAt} | ✓ 유효 access token + 프로파일 반환 | — | — | ✓ | PASS |
| SC-020 | 토큰 부재 → GET /auth/me 401 | — | — | ✓ 401 JwtAuthGuard | ✓ | PASS |
| SC-021 | 만료 Access Token → 보호 라우트 401 | — | ✓ expiresIn=-1 경계 만료 토큰 | — | ✓ | PASS |
| SC-022 | Dockerfile 멀티스테이지 빌드 존재 | ✓ FROM 개수·stage명 정적 검증 | — | — | ✓ | PASS |
| SC-023 | CI lint → typecheck needs chain | — | — | ✓ needs 배열 정적 검증 | ✓ | PASS |
| SC-024 | CI typecheck → test needs chain | — | — | ✓ needs 배열 정적 검증 | ✓ | PASS |
| SC-025 | CI test → docker-build needs chain | — | — | ✓ needs 배열 정적 검증 | ✓ | PASS |
| SC-026 | CI 전 단계 통과 시 docker-build 실행 | ✓ needs chain 완결 정적 검증 | — | — | ✓ | PASS |
| SC-027 | POST /auth/login P95 ≤ 500ms (50회) | — | ✓ 50회 연속 P95 측정 (P95≈139ms) | — | ✓ | **PASS** |

### 커버리지 요약

| 항목 | 수치 |
|---|---|
| SC 총 수 | 27 |
| PASS | **27** |
| FAIL | 0 |
| 테스트 미작성 SC | 0 |
| deferred SC | 0 |

---

## STALE_SC 경고

STALE_SC 점검 결과: **0건**

- spec.md 내 SC 번호 집합: SC-001 ~ SC-027 (27개)
- 테스트 파일(test/, src/) 내 SC 번호 집합: SC-001 ~ SC-027 (27개)
- 두 집합 완전 일치 → STALE_SC 없음

```yaml
stale_sc:
  count   : 0
  decision: NONE_FOUND
```
