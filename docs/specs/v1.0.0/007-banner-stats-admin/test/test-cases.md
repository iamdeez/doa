---
작성: Test Agent (AUTHORING)
버전: v1.0
최종 수정: 2026-06-29 18:15
상태: 확정 (retroactive)
---

# Test Cases: 007-banner-stats-admin

## 목차

- [SC × 시나리오 매트릭스](#sc--시나리오-매트릭스)
  - [배너 (SC-001~004)](#배너-sc-001004)
  - [통계 (SC-005~006)](#통계-sc-005006)
  - [운영관리 (SC-007~009)](#운영관리-sc-007009)
  - [통합·정적 (SC-010, SC-011)](#통합정적-sc-010-sc-011)
- [외부 의존성 명시](#외부-의존성-명시)
- [미커버 항목 (사전 분류)](#미커버-항목-사전-분류)

---

## SC × 시나리오 매트릭스

> 테스트 함수명은 실제 spec 파일의 `it('...')` 식별자 기준.
> 신규 단위 테스트: banner 11 + stats 4 + admin 5 = **20**. 통합 부팅 8(e2e) + 정적 cross-schema 3 규칙.

### 배너 (SC-001~004)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | 테스트 파일·함수 | env 태그 |
|---|---|---|---|---|---|---|
| SC-001 | create 위임 | `when_create_then_delegates_to_repository` | — | — | banner.service.spec.ts::create | [env:unit] |
| SC-002 | update 부분/404 | `when_exists_then_partial_update` | — | `when_not_found_then_NotFoundException` | banner.service.spec.ts::update | [env:unit] |
| SC-003 | remove/404 | `when_exists_then_deletes` | — | `when_not_found_then_NotFoundException` | banner.service.spec.ts::remove | [env:unit] |
| SC-004 | listPublic 노출기간 필터 | `when_no_period_then_always_visible`, `when_now_inside_period_then_visible`, `when_mixed_then_only_active_within_period_in_order` | `when_boundary_equals_now_then_visible` | `when_not_yet_started_then_hidden`, `when_already_ended_then_hidden` | banner.service.spec.ts::listPublic | [env:unit] |

### 통계 (SC-005~006)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | 테스트 파일·함수 | env 태그 |
|---|---|---|---|---|---|---|
| SC-005 | overview 조합·Decimal 매출 | `when_called_then_combines_domain_aggregates_with_decimal_sales` | `when_no_completed_orders_then_zero_decimal_sales` | — | stats.service.spec.ts::getOverview | [env:unit] |
| SC-006 | seller stats 본인 격리 | `when_approved_seller_then_returns_own_summary` | — | `when_not_approved_seller_then_ForbiddenException` | stats.service.spec.ts::getSellerStats | [env:unit] |

### 운영관리 (SC-007~009)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | 테스트 파일·함수 | env 태그 |
|---|---|---|---|---|---|---|
| SC-007 | listPendingSellers PENDING | `when_called_then_queries_PENDING_status` | — | — | admin.service.spec.ts::listPendingSellers | [env:unit] |
| SC-008 | approveSeller 재사용 | `when_called_then_reuses_seller_approve` | — | — | admin.service.spec.ts::approveSeller | [env:unit] |
| SC-009 | listUsers limit 클램프 | `when_limit_undefined_then_uses_default_clamped_take` | `when_limit_exceeds_max_then_clamped_to_max`, `when_limit_below_one_then_clamped_to_one` | — | admin.service.spec.ts::listUsers | [env:unit] |

### 통합·정적 (SC-010, SC-011)

| SC-ID | 수용 기준 | Happy Path | Error Case | 테스트 파일·함수 | env 태그 |
|---|---|---|---|---|---|
| SC-010 | AppModule 부팅 + 라우트·노출기간·권한 | `when_get_banners_without_auth_then_200_array`, `when_admin_creates_active_banner_then_visible_in_public_list`, `when_admin_gets_stats_overview_then_200_with_metrics`, `when_admin_lists_pending_sellers_then_200_array` | `when_admin_banners_without_token_then_401`, `when_admin_banners_with_non_admin_token_then_403`, `when_admin_creates_future_banner_then_hidden_in_public_list`, `when_non_admin_gets_stats_overview_then_403` | banner-admin.e2e-spec.ts | [env:integration] |
| SC-011 | banner·stats·admin Repository cross-schema 직접 참조 0 | `when_inspect_BannerRepository__007__then_no_cross_schema_prisma_access`, `when_inspect_StatsRepository__007__then_no_cross_schema_prisma_access`, `when_inspect_AdminRepository__007__then_no_cross_schema_prisma_access` | — | test/static/cross-schema.spec.ts | [env:static] |

---

## 외부 의존성 명시

### fixture / mock

- `mockRepo`(banner): `{ create, findById, update, delete, listAll, listActiveOrdered }` jest.fn()
- `mockOrder`(stats): `{ countAllOrders, countCompletedOrders, sumCompletedSales, getSellerSalesSummary }` jest.fn()
- `mockUser`(stats/admin): `{ countAllUsers, listUsersForAdmin }` jest.fn()
- `mockSeller`(stats/admin): `{ countAllSellers, getApprovedSeller, listByStatus, approve }` jest.fn()
- Decimal fixture: `new Prisma.Decimal(...)` — totalSales·salesTotal 단언
- e2e: `Test.createTestingModule({imports:[AppModule]})` + `ValidationPipe` + adminToken/userToken(JWT 발급), createdBannerIds 정리

### 환경 변수

- 단위 테스트: 별도 환경 변수 불필요(전부 mock, DB 연결 없음).
- 통합 부팅 테스트(`banner-admin.e2e-spec.ts`): PostgreSQL 기동 + 마이그레이션 적용 + `.env`(`DATABASE_URL`·`JWT_*`·`ADMIN_USER_IDS`) 전제. AdminGuard 가 `ADMIN_USER_IDS` 로 adminToken 사용자를 통과시키려면 해당 env 에 admin user id 포함 필요.

### 외부 서비스

- 단위·정적: DB·네트워크 연결 없음. 전부 mock.
- 통합: AppModule 부팅이 실제 PostgreSQL 연결을 요구(GET /banners 200·배너 생성·통계 조회).

---

## 미커버 항목 (사전 분류)

| 항목 | 미커버 사유 | 카테고리 | 권장 검증 방법 |
|---|---|---|---|
| `BannerService.listAll` 직접 단위 테스트 | banner.service.spec 가 create·update·remove·listPublic 을 단언하나 `listAll`(thin delegation)은 직접 단위 테스트 없음. 관리자 라우트 등록은 e2e 부팅(SC-010)으로 간접 확인 | (1) 단위테스트 가능 | banner.service.spec 에 listAll 위임 단언 추가 권장 |
| 관리자 액션 audit log | production 에 감사 로그 테이블·기록 로직 자체가 없음 → 추적 단언 대상 부재 | (3) 기능 미구현 | 후속 spec 에서 admin_audit_logs(append-only) + 기록 테스트 (GAP-007-01) |
| 배너 노출기간 DB where 절 푸시다운 | production 노출기간 필터가 애플리케이션 레벨(in-memory) → DB 쿼리 검증 대상 부재 | (3) 기능 미구현 | 배너 수 증가 시 startsAt/endsAt DB 필터 + 쿼리 테스트 (GAP-007-02) |
| 판매자 승인 라우트 일원화 | seller·admin 병렬 approve 라우트(OBS-007-01) — 두 라우트 모두 동작·AdminGuard 보호. 일원화는 정책 결정 | (2) 설계 관찰 | 운영 라우트 admin 일원화 후속 정책 spec |
| `OrderRepository.getSellerCompletedSummary` 직접 단위 테스트 | stats.service.spec 가 `mockOrder.getSellerSalesSummary` 반환을 단언하나 Decimal 누적 산술(`unitPrice.mul(quantity)`) 자체는 직접 단위 테스트 미작성. e2e 부팅·order 기존 테스트로 간접 커버 | (1) 단위테스트 가능 | order.repository 집계 직접 테스트(Decimal 정확성) 추가 권장 |
