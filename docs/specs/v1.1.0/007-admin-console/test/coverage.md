---
작성: Test Agent (EXECUTION)
버전: v1.0
최종 수정: 2026-06-30 02:10
상태: 확정 (retroactive)
---

# Coverage: 007-admin-console

## 목차

- [실행 요약](#실행-요약)
- [SC × 시나리오 커버리지 매트릭스](#sc--시나리오-커버리지-매트릭스)
- [커버리지 요약](#커버리지-요약)
- [STALE_SC 경고](#stale_sc-경고)

---

## 실행 요약

> 본 retroactive 검증은 007 완료 커밋 `e7d8ebb`(base `1a6d70d`, Phase 3 관리자 콘솔) 기준으로 main session 이
> 게이트를 직접 재실행·구조 확인한 결과다. 본 차수는 UI 화면으로 별도 e2e/단위 테스트 스위트가 없으며, SC 는
> **타입체크 + console 빌드 + 정적 구조 검증**으로 판정한다.

| 항목 | 본 retroactive 검증 (HEAD `e7d8ebb`) |
|---|---|
| console typecheck | **0 error** (`pnpm --filter console typecheck` — main 검증) |
| console build | **22 라우트 PASS** (신규 `/admin/stats`·`/admin/settlements`·`/admin/users`·`/admin/audit-logs`·`/admin/banners` 포함 — main 검증) |
| 플랫폼 통계 | `stats/page.tsx` — `useQuery(api.admin.statsOverview)` + StatCard 5개(매출 formatKRW·주문·사용자·판매자) |
| 전체 정산 | `settlements/page.tsx` — `useQuery(api.admin.settlements)` + Table(판매자·상태 Badge completed/pending) |
| 사용자 | `users/page.tsx` — `useInfiniteQuery(api.admin.users)`·`flatMap(items)`·"더 보기" |
| 감사 로그 | `audit-logs/page.tsx` — `useQuery(api.admin.auditLogs)` + Table(action Badge) |
| 판매자 승인 | `sellers/page.tsx` — `pendingSellers` + `approveSeller` invalidate·행별 비활성화 |
| 배너 | `banners/page.tsx` — `banners`·`CreateBannerDialog`(create invalidate)·toggle·delete |
| view 타입 | `shared-types/index.ts` — 9종(`PlatformOverview`·`AdminUser`·`AdminAuditLog`·`AdminSeller`·`Banner` 등, 금전 string) |
| facade | `api-client/index.ts` — admin 10 메서드(`api.http` 기반) |
| 네비 | `layout.tsx` — "배너"·"전체 정산"·"플랫폼 통계"·"사용자"·"감사 로그" 5개 추가 |
| 신규 단위/e2e 테스트 | **0** (UI 화면 — 타입체크·빌드·정적 갈음) |
| 마이그레이션 | **없음** (DB 스키마 변경 0) |
| 신규 의존 | **0** (`package.json` 변경 없음) |

> **신규 단위/e2e 0 산정 근거(사실 기준)**: 007 git diff(`git diff 1a6d70d e7d8ebb -- apps/console packages`)의
> 변경 파일 9종(화면 5 신규·sellers 수정·`layout.tsx`·`api-client/index.ts`·`shared-types/index.ts`)에
> `*.spec.ts`·`*.test.ts`·`*.e2e.ts` 변경/추가가 0 이다. 검증은 console typecheck/build + 정적 구조 리뷰로
> 갈음한다.

### 변경 라인 직접 카운트 (자가 보고 비신뢰)

| 파일 | 추가 | 삭제 | 방법 |
|---|---|---|---|
| `apps/console/.../admin/banners/page.tsx`(신규) | 172 | 0 | `git diff --numstat 1a6d70d e7d8ebb` |
| `packages/shared-types/src/index.ts` | 77 | 0 | 동일(admin view 타입 9종) |
| `apps/console/.../admin/sellers/page.tsx` | 72 | 13 | 동일(플레이스홀더→실데이터) |
| `apps/console/.../admin/users/page.tsx`(신규) | 71 | 0 | 동일 |
| `apps/console/.../admin/settlements/page.tsx`(신규) | 64 | 0 | 동일 |
| `apps/console/.../admin/audit-logs/page.tsx`(신규) | 61 | 0 | 동일 |
| `apps/console/.../admin/stats/page.tsx`(신규) | 32 | 0 | 동일 |
| `packages/api-client/src/index.ts` | 32 | 0 | 동일(admin facade 10 메서드) |
| `apps/console/app/(dashboard)/layout.tsx` | 5 | 0 | 동일(네비 5개) |

**합계**: 9 files changed, 586 insertions(+), 13 deletions(-).

### 실행 커맨드

```bash
pnpm --filter console typecheck          # tsc --noEmit (0 error)
pnpm --filter console build              # 22 라우트 PASS (신규 admin stats·settlements·users·audit-logs·banners)
git diff --numstat 1a6d70d e7d8ebb -- apps/console packages   # 변경 라인 카운트 (9 files +586/-13)
```

---

## SC × 시나리오 커버리지 매트릭스

| SC-ID | 수용 기준 | 케이스 | 상태 |
|---|---|---|---|
| SC-001 | 통계 StatCard 5·금전 | stats/page.tsx + console typecheck/build | PASS(typecheck/build) |
| SC-002 | 정산 Table·상태 Badge | settlements/page.tsx + console typecheck/build | PASS(typecheck/build) |
| SC-003 | 사용자 무한스크롤 | users/page.tsx 리뷰 + console build | VERIFIED(static)/PASS(typecheck/build) |
| SC-004 | 감사 로그 Table | audit-logs/page.tsx + console typecheck/build | PASS(typecheck/build) |
| SC-005 | 판매자 승인 | sellers/page.tsx 리뷰 | VERIFIED(static) |
| SC-006 | 배너 CRUD | banners/page.tsx 리뷰 + console build | VERIFIED(static)/PASS(typecheck/build) |
| SC-007 | view 타입·facade | shared-types·api-client 리뷰 | VERIFIED(static)/PASS(typecheck) |
| SC-008 | 네비·회귀 0 | layout 리뷰 + console typecheck/build | PASS(typecheck/build)/VERIFIED(static) |

---

## 커버리지 요약

| 항목 | 수 |
|---|---|
| 전체 SC | 8 (통계 1 + 정산 1 + 사용자 1 + 감사 1 + 판매자 승인 1 + 배너 CRUD 1 + view 타입/facade 1 + 네비 1) |
| PASS (타입체크·빌드 직접) | 3 (SC-001·002·004) |
| VERIFIED (정적 구조 검증) | 2 (SC-005·SC-007 — 승인 mutation·view 타입/facade 코드 리뷰) |
| PASS+VERIFIED 혼합 | 3 (SC-003·SC-006·SC-008 — 무한스크롤/배너 CRUD/네비 정적 + 라우트 컴파일) |
| GAP | 0 (단, e2e 부재·배너 삭제 확인·클라이언트 권한 차단·배너 편집·낙관적 업데이트는 coverage-gap.md·GAP-007-01 참조) |

> SC-001(통계)·SC-002(정산)·SC-004(감사 로그)는 console typecheck/build 로 직접 PASS, SC-003(사용자 무한
> 스크롤)·SC-006(배너 CRUD)·SC-008(네비·회귀)은 정적 리뷰 + 라우트 컴파일, SC-005(판매자 승인)·SC-007(view
> 타입·facade)은 정적 구조 리뷰로 확인(VERIFIED). 모든 SC 가 충족되며, e2e 부재·배너 삭제 확인·클라이언트 권한
> 노출 차단·배너 편집·낙관적 업데이트는 Low 잔여 권고다(GAP-007-01). Phase 3 핵심 목표(관리자 플랫폼 통계·전체
> 정산·사용자·감사 로그·판매자 승인·배너 관리 화면)는 console typecheck 0·build 22 라우트 PASS 로 달성.

---

## STALE_SC 경고

STALE_SC 검출 결과: **0건**

검출 대상: 007 git diff(`git diff 1a6d70d e7d8ebb -- apps/console packages`) 변경 파일. 변경 파일에 테스트
SC 번호를 포함한 `*.spec.ts`·`*.test.ts`·`*.e2e.ts` 가 없고(UI 화면), SC 판정은 본 coverage.md·test-cases.md
가 정적 구조 리뷰 + console typecheck/build 로 담당한다. semantic mismatch 없음.
