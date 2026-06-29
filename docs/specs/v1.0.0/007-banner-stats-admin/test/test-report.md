---
작성: Test Agent (EXECUTION)
버전: v1.0
최종 수정: 2026-06-29 18:15
상태: 확정 (retroactive)
---

# 테스트 실행 결과 — 007-banner-stats-admin

## 목차

- [실행 요약](#실행-요약)
- [실패 목록](#실패-목록)
- [SC 매핑표 검증](#sc-매핑표-검증)
- [설계 문서 정합성](#설계-문서-정합성)
- [회귀 탐지](#회귀-탐지)

---

## 실행 요약

> 본 retroactive 검증은 007 완료 커밋 `7a9ed2c` 에서 main session 이 게이트를 직접 재실행·코드리뷰하여
> 확인했다. 신규 단위 테스트 개수는 실제 spec 파일의 `it()` 를 직접 카운트하여 산정했다(추측 금지).

| 항목 | 결과 (HEAD `7a9ed2c`) |
|---|---|
| 실행 일시 | 2026-06-29 18:15 |
| tsc `--noEmit` | **EXIT 0** |
| Unit 테스트 (apps/backend, rootDir: src) | **229 PASS** / 0 FAIL / 24 suites |
| e2e + Static 테스트 (apps/backend, test/) | **84 PASS** / 0 FAIL / 16 suites |
| 전체 통과 여부 | **PASS** |
| 002~006 회귀 여부 | **없음** |
| AppModule 부팅 | 정상 — BannerModule·StatsModule·AdminModule 3개 DI 등록 |
| 007 신규 단위 테스트 | **20** (banner.service.spec 11 + stats.service.spec 4 + admin.service.spec 5) |

### 006 → 007 델타

| 항목 | 006 완료(`3df34ac`) | 007 완료(`7a9ed2c`) | 델타 |
|---|---|---|---|
| Unit suites / PASS | 21 / 209 | 24 / 229 | **+20 PASS** (banner 11 + stats 4 + admin 5) / +3 suites |
| e2e + static suites / PASS | 15 / 73 | 16 / 84 | 신규 `banner-admin.e2e`(8) + cross-schema 규칙(+3) 포함 / +1 suite |

> **신규 단위 20 산정(직접 카운트)**: `grep -cE '\bit\('` 기준 — banner.service.spec.ts=11,
> stats.service.spec.ts=4, admin.service.spec.ts=5. 합 20 = 006 baseline 209 + 20 = 229 정합.
> **e2e+static +11 산정**: banner-admin.e2e 8 케이스 + cross-schema.spec 신규 규칙 3건(`for (rule of
> CROSS_SCHEMA_RULES) it(...)` — Banner·Stats·Admin Repository(007) 각 1 it()). auth-required-guards.spec
> 는 기존 단일 it() 의 검증 대상 목록에 banner·stats·admin 컨트롤러 경로 3개를 추가(신규 it() 아님 →
> case 수 무변). 73 + 8 + 3 = 84.

### 실행 커맨드

```bash
cd /Users/krystal/workspace/doa/doa-next/apps/backend
npx tsc --noEmit -p tsconfig.json                                              # EXIT 0
npx jest --testPathPattern="src/"                                              # 24 suites / 229 PASS
npx jest --config ./test/jest-e2e.json                                         # 16 suites / 84 PASS (e2e + static)
```

> **DB 의존 e2e 명시**: `banner-admin.e2e-spec.ts`·`search-notification-file.e2e-spec.ts`·
> `orders.e2e-spec.ts`·`payments.e2e-spec.ts`·`products.e2e-spec.ts`·`auth.e2e-spec.ts`·
> `health.e2e-spec.ts` 는 PostgreSQL 연결을 요구한다. `banner-admin.e2e` 는 AppModule 부팅으로
> BannerModule·StatsModule·AdminModule DI 와이어링 + 공개/인증/관리자 라우트(200/401/403)와 배너
> 노출기간 동작(활성 노출·미래 숨김)을 검증한다(SC-010). AdminGuard 통과를 위해 `ADMIN_USER_IDS`
> 환경변수에 adminToken 사용자 id 포함이 전제다.

---

## 실패 목록

**실패 없음.** tsc EXIT 0, unit 229 + e2e/static 84 = 전체 PASS.

---

## SC 매핑표 검증

| SC-ID | 관련 테스트 | 통과 여부 |
|---|---|---|
| SC-001 | banner.service.spec.ts: when_create_then_delegates_to_repository | PASS |
| SC-002 | banner.service.spec.ts: when_exists_then_partial_update, when_not_found_then_NotFoundException | PASS |
| SC-003 | banner.service.spec.ts: when_exists_then_deletes, when_not_found_then_NotFoundException | PASS |
| SC-004 | banner.service.spec.ts: when_no_period_then_always_visible, when_now_inside_period_then_visible, when_not_yet_started_then_hidden, when_already_ended_then_hidden, when_mixed_then_only_active_within_period_in_order, when_boundary_equals_now_then_visible | PASS |
| SC-005 | stats.service.spec.ts: when_called_then_combines_domain_aggregates_with_decimal_sales, when_no_completed_orders_then_zero_decimal_sales | PASS |
| SC-006 | stats.service.spec.ts: when_approved_seller_then_returns_own_summary, when_not_approved_seller_then_ForbiddenException | PASS |
| SC-007 | admin.service.spec.ts: when_called_then_queries_PENDING_status | PASS |
| SC-008 | admin.service.spec.ts: when_called_then_reuses_seller_approve | PASS |
| SC-009 | admin.service.spec.ts: when_limit_undefined_then_uses_default_clamped_take, when_limit_exceeds_max_then_clamped_to_max, when_limit_below_one_then_clamped_to_one | PASS |
| SC-010 | banner-admin.e2e-spec.ts: when_get_banners_without_auth_then_200_array, when_admin_banners_without_token_then_401, when_admin_banners_with_non_admin_token_then_403, when_admin_creates_active_banner_then_visible_in_public_list, when_admin_creates_future_banner_then_hidden_in_public_list, when_admin_gets_stats_overview_then_200_with_metrics, when_non_admin_gets_stats_overview_then_403, when_admin_lists_pending_sellers_then_200_array | PASS |
| SC-011 | test/static/cross-schema.spec.ts: when_inspect_BannerRepository__007__then_no_cross_schema_prisma_access, when_inspect_StatsRepository__007__then_no_cross_schema_prisma_access, when_inspect_AdminRepository__007__then_no_cross_schema_prisma_access | PASS |

---

## 설계 문서 정합성

### plan.md 현행화 점검

- 배너 admin.banners 단독 소유 — `BannerRepository.this.prisma.banner`(루트 직접) — plan.md ADR-001 과
  구현 일치 ✓
- 배너 노출기간 애플리케이션 필터(`listActiveOrdered` 후 `isWithinPeriod`) — plan.md ADR-002 와 일치 ✓
  (경계값 포함 `<=`)
- stats 자체 테이블 없음 — `OrderService`/`UserService`/`SellerService` DI 조합, `StatsRepository` 빈
  클래스 — plan.md ADR-003 과 일치 ✓
- admin 자체 테이블 없음 — `SellerService.approve` 재사용·`UserService.listUsersForAdmin` DI,
  `AdminRepository` 빈 클래스 — plan.md ADR-004·ADR-005 와 일치 ✓
- 매출 집계 Prisma.Decimal(`sumCompletedTotalAmount` aggregate·`getSellerCompletedSummary` mul/add) —
  plan.md ADR-006·P-005 와 일치 ✓
- admin listUsers cursor + 민감 필드 제외(`AdminUserListItem` — password 미포함) — plan.md ADR-007 과
  일치 ✓
- cross-schema 금지: cross-schema.spec.ts 에 BannerRepository·StatsRepository·AdminRepository 규칙
  반영 ✓
- 관리자 인가(JwtAuthGuard+AdminGuard fail-closed): auth-required-guards.spec.ts 에 banner·stats·admin
  컨트롤러 반영 ✓

### 발견된 한계·관찰

- **관리자 audit log 부재**: 승인·삭제 추적 테이블 없음. 코드 수정 없이 후속 spec 위임(GAP-007-01).
- **배너 노출기간 in-memory 필터**: DB 푸시다운 부재(GAP-007-02).
- **판매자 승인 병렬 라우트(OBS-007-01)**: seller·admin 두 라우트가 `SellerService.approve` 재사용
  호출. Low, 후속 일원화 정책 위임.

### 002~006 회귀 확인

- order/user/seller.service.spec.ts: 007 의 집계 메서드는 additive 공개이며 기존 메서드 시그니처 불변 →
  002~006 기존 테스트 PASS. `SellerService.approve` 는 재사용(로직 불변)이라 기존 seller 테스트 PASS.
- 기타 모듈(cart/order/payment/coupon/review/shipping/settlement/search/notification/file): 모든 기존
  테스트 PASS.

---

## 회귀 탐지

007 이 추가/변경한 테스트 파일 (`git diff 3df34ac 7a9ed2c` 기준):
- `src/modules/banner/banner.service.spec.ts`: 신규 (+208, 11 케이스)
- `src/modules/stats/stats.service.spec.ts`: 신규 (+117, 4 케이스)
- `src/modules/admin/admin.service.spec.ts`: 신규 (+110, 5 케이스)
- `test/banner-admin.e2e-spec.ts`: 신규 (+163, 8 케이스 — AppModule 부팅·라우트·노출기간·권한, SC-010)
- `test/static/cross-schema.spec.ts`: 확장 (+40 — Banner·Stats·AdminRepository(007) 규칙 3건)
- `test/static/auth-required-guards.spec.ts`: 확장 (+8 — banner·stats·admin 컨트롤러 검증 대상 추가)

006 baseline(209 unit) 대비 007 신규 20 → 229 unit (회귀 0). e2e+static 16 suites/84 PASS, 전체
PASS·회귀 0 을 확인했다.
