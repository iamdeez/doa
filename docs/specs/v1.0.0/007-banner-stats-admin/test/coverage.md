---
작성: Test Agent (EXECUTION)
버전: v1.0
최종 수정: 2026-06-29 18:15
상태: 확정 (retroactive)
---

# Coverage: 007-banner-stats-admin

## 목차

- [실행 요약](#실행-요약)
- [SC × 시나리오 커버리지 매트릭스](#sc--시나리오-커버리지-매트릭스)
- [커버리지 요약](#커버리지-요약)
- [STALE_SC 경고](#stale_sc-경고)

---

## 실행 요약

> 본 retroactive 검증은 007 완료 커밋 `7a9ed2c` 기준으로 main session 이 게이트를 직접 재실행·코드리뷰하여
> 확인한 수치다. 신규 단위 테스트 개수는 실제 spec 파일의 `it()` 를 직접 카운트하여 확정했다.

| 항목 | 본 retroactive 검증 (HEAD `7a9ed2c`) |
|---|---|
| tsc `--noEmit` | **EXIT 0** |
| Unit 테스트 (src/) | **24 suites / 229 PASS** (006 대비 +20) |
| e2e + Static 테스트 (test/) | **16 suites / 84 PASS** (신규 `banner-admin.e2e` 포함) |
| AppModule 부팅 | 정상 — BannerModule·StatsModule·AdminModule 3개 DI 등록 |
| 007 신규 단위 테스트 | **20** (banner 11 + stats 4 + admin 5 — `it()` 직접 카운트) |
| 007 회귀 | **0** (전체 PASS) |

> **신규 단위 20 산정 근거(사실 기준)**:
> - `banner.service.spec.ts` = 11 케이스 (`grep -cE '\bit\('` 직접 카운트 — create 1 + update 2 + remove 2 + listPublic 6)
> - `stats.service.spec.ts` = 4 케이스 (getOverview 2 + getSellerStats 2)
> - `admin.service.spec.ts` = 5 케이스 (listPendingSellers 1 + approveSeller 1 + listUsers 3)
> - 합 20 = 006 baseline 209 + 20 = 229 로 정합.
> - 추가로 통합 부팅 `banner-admin.e2e-spec.ts` 8 케이스 + 정적 `cross-schema.spec.ts` 에
>   BannerRepository(007)·StatsRepository(007)·AdminRepository(007) 규칙 3건이 e2e+static 묶음
>   (16 suites/84)에 포함. e2e+static = 006(15/73) + banner-admin.e2e 8 + cross-schema 규칙 3 = 16/84.

### 실행 커맨드

```bash
cd apps/backend
npx tsc --noEmit -p tsconfig.json                                              # EXIT 0
npx jest --testPathPattern="src/"                                              # 24 suites / 229 PASS
npx jest --config ./test/jest-e2e.json                                         # 16 suites / 84 PASS (e2e + static)
```

> 단위 테스트는 `package.json` jest 설정(rootDir: "src")으로 실행한다. e2e·정적 테스트는
> `test/jest-e2e.json`(rootDir: ".") 으로 실행하며 통합 부팅(`banner-admin.e2e`)은 PostgreSQL
> 연결 + `ADMIN_USER_IDS` 환경변수를 요구한다.

---

## SC × 시나리오 커버리지 매트릭스

### 배너 (SC-001~004)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | 상태 |
|---|---|---|---|---|---|
| SC-001 | create 위임 | when_create_then_delegates_to_repository | — | — | PASS |
| SC-002 | update 부분/404 | when_exists_then_partial_update | — | when_not_found_then_NotFoundException | PASS |
| SC-003 | remove/404 | when_exists_then_deletes | — | when_not_found_then_NotFoundException | PASS |
| SC-004 | listPublic 노출기간 필터 | when_no_period_then_always_visible, when_now_inside_period_then_visible, when_mixed_then_only_active_within_period_in_order | when_boundary_equals_now_then_visible | when_not_yet_started_then_hidden, when_already_ended_then_hidden | PASS |

### 통계 (SC-005~006)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | 상태 |
|---|---|---|---|---|---|
| SC-005 | overview 조합·Decimal | when_called_then_combines_domain_aggregates_with_decimal_sales | when_no_completed_orders_then_zero_decimal_sales | — | PASS |
| SC-006 | seller stats 본인 격리 | when_approved_seller_then_returns_own_summary | — | when_not_approved_seller_then_ForbiddenException | PASS |

### 운영관리 (SC-007~009)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | 상태 |
|---|---|---|---|---|---|
| SC-007 | listPendingSellers PENDING | when_called_then_queries_PENDING_status | — | — | PASS |
| SC-008 | approveSeller 재사용 | when_called_then_reuses_seller_approve | — | — | PASS |
| SC-009 | listUsers 클램프 | when_limit_undefined_then_uses_default_clamped_take | when_limit_exceeds_max_then_clamped_to_max, when_limit_below_one_then_clamped_to_one | — | PASS |

### 통합·정적 (SC-010, SC-011)

| SC-ID | 수용 기준 | 시나리오 | 상태 |
|---|---|---|---|
| SC-010 | AppModule 부팅 + 라우트·노출기간·권한 | when_get_banners_without_auth_then_200_array, when_admin_banners_without_token_then_401, when_admin_banners_with_non_admin_token_then_403, when_admin_creates_active_banner_then_visible_in_public_list, when_admin_creates_future_banner_then_hidden_in_public_list, when_admin_gets_stats_overview_then_200_with_metrics, when_non_admin_gets_stats_overview_then_403, when_admin_lists_pending_sellers_then_200_array | PASS |
| SC-011 | banner·stats·admin Repository cross-schema 0 | cross-schema.spec.ts BannerRepository(007)·StatsRepository(007)·AdminRepository(007) 규칙 | PASS |

---

## 커버리지 요약

| 항목 | 수 |
|---|---|
| 전체 SC | 11 (배너 4 + 통계 2 + 운영관리 3 + 통합 1 + 정적 1) |
| PASS (직접 커버) | 11 |
| INDIRECT (간접 커버) | 0 (단, FR-004 admin listAll 은 SC-010 부팅으로 라우트 등록만 간접 확인 — coverage-gap.md 참조) |
| GAP | 0 (단, 관리자 audit log·노출기간 DB 푸시다운은 기능 미구현 — coverage-gap.md 참조) |

> 모든 SC(SC-001~011)가 직접 커버되었다. 단, `BannerService.listAll`·`OrderRepository.getSellerCompletedSummary`
> 의 직접 단위 단언은 부재(thin delegation·간접 커버)이며, 관리자 *audit log*·배너 노출기간 *DB 푸시다운*·
> 승인 라우트 *일원화* 는 production 기능/정책이 없거나 미결로 SC 로 정의되지 않았다. 이는 의도된 범위 외
> (GAP-007-01·02, OBS-007-01)로 coverage-gap.md 에 기록한다.

---

## STALE_SC 경고

STALE_SC 검출 결과: **0건**

검출 대상: 007 git diff(`git diff 3df34ac 7a9ed2c -- apps/backend`) 변경 파일 내 테스트 SC 번호.
`banner.service.spec.ts`·`stats.service.spec.ts`·`admin.service.spec.ts` 는 docstring 시나리오 주석에
SC 번호를 직접 부착하지 않고 행위 기반 `it('when_..._then_...')` 명명을 사용한다(spec.md SC 와의 매핑은 본
coverage.md·test-cases.md 가 담당). 정적 스펙(`cross-schema.spec.ts` 의 BannerRepository(007)·
StatsRepository(007)·AdminRepository(007) 라벨)에서 사용된 식별자도 spec.md/data-model.md 정의와
일치한다. semantic mismatch 없음.
