---
작성: Docs Agent
버전: v1.0
최종 수정: 2026-06-29 18:15
상태: 확정 (retroactive)
---

# Diff: 007-banner-stats-admin

## 커밋 메시지용 한 줄 요약

(이 섹션은 커밋 메시지 작성 시 참고용이다. 실제 커밋 메시지는 프로젝트 컨벤션에 맞춰 조정한다.)

- **KO**: 배너·통계·운영관리 모듈 실구현 및 order/user/seller 집계 메서드 추가
- **EN**: implement banner, stats & admin modules with order/user/seller aggregate methods

## 변경 요약

- **Prisma 스키마**: `BannerPosition`(admin) enum(MAIN_TOP·MAIN_MIDDLE·MAIN_BOTTOM·SIDEBAR), `Banner`(신규 admin 스키마, `@@map("banners")`) 모델 추가. `banners(isActive, position, sortOrder)` 인덱스. **금전 필드 없음**(P-005 banner 해당 없음). FK 없음(단일 테이블, cross-schema 참조 컬럼 없음).
- **banner 모듈 스텁 → 실구현**: BannerRepository(create·findById·update·delete·listAll·listActiveOrdered — `this.prisma.banner` 루트 직접), BannerService(create·update 404·remove 404·listAll·listPublic 노출기간 `isWithinPeriod` 필터), AdminBannerController(POST 201·PATCH·DELETE 204·GET — JwtAuthGuard+AdminGuard)·BannerController(GET /banners — 공개 무가드), create/update dto. BannerService export.
- **stats 모듈 스텁 → 실구현**: StatsRepository(빈 클래스 — 자체 테이블 없음), StatsService(getOverview — order/user/seller 5집계 Promise.all·totalSales Decimal; getSellerStats — getApprovedSeller 본인 격리 후 매출 요약), AdminStatsController(GET /admin/stats/overview — JwtAuthGuard+AdminGuard)·SellerStatsController(GET /seller/stats — JwtAuthGuard 본인).
- **admin 모듈 스텁 → 실구현**: AdminRepository(빈 클래스), AdminService(listPendingSellers — listByStatus PENDING; approveSeller — SellerService.approve 재사용; listUsers — limit 클램프 1..100 후 listUsersForAdmin), AdminController(GET /admin/sellers/pending·POST /admin/sellers/:id/approve 200·GET /admin/users — JwtAuthGuard+AdminGuard), 상수(DEFAULT/MAX_USER_PAGE_LIMIT).
- **order 모듈 007 연동(additive 공개)**: `OrderService`(countAllOrders·countCompletedOrders·sumCompletedSales(Decimal)·getSellerSalesSummary) + `OrderRepository`(countAll·countCompleted·sumCompletedTotalAmount(aggregate _sum, 없으면 Decimal(0))·getSellerCompletedSummary(unitPrice.mul(quantity) Decimal 누적)). 기존 시그니처 불변(002~006 회귀 0).
- **user 모듈 007 연동(additive 공개)**: `UserService`(countAllUsers·listUsersForAdmin — AdminUserListItem password 제외 cursor) + `UserRepository`(countAll·listPaginated cursor) + `UserModule` exports UserService.
- **seller 모듈 007 연동(additive 공개)**: `SellerService`(countAllSellers·listByStatus) + `SellerRepository`(countAll·listByStatus). `approve` 는 기존 재사용(병렬 라우트 — OBS-007-01, 로직 불변).
- **테스트 추가**: banner.service.spec(11 케이스 — SC-001/002/003/004), stats.service.spec(4 케이스 — SC-005/006), admin.service.spec(5 케이스 — SC-007/008/009), banner-admin.e2e(8 케이스 — AppModule 부팅·라우트·노출기간·권한, SC-010), cross-schema.spec(Banner·Stats·AdminRepository 규칙 3건, SC-011), auth-required-guards.spec(banner·stats·admin 컨트롤러 검증 대상 추가).

## 변경 파일 및 라인 수

> 범위: `apps/backend`. base `3df34ac`(006 SDD 문서 커밋) → `7a9ed2c`(007 완료).

| 파일 | 추가 | 삭제 |
|---|---|---|
| `apps/backend/prisma/migrations/20260629085122_007_banner_stats_admin/migration.sql` | +21 | -0 |
| `apps/backend/prisma/schema.prisma` | +34 | -0 |
| `apps/backend/src/modules/admin/admin.constants.ts` | +3 | -0 |
| `apps/backend/src/modules/admin/admin.controller.ts` | +44 | -2 |
| `apps/backend/src/modules/admin/admin.module.ts` | +4 | -0 |
| `apps/backend/src/modules/admin/admin.repository.ts` | +5 | -0 |
| `apps/backend/src/modules/admin/admin.service.spec.ts` | +110 | -0 |
| `apps/backend/src/modules/admin/admin.service.ts` | +43 | -1 |
| `apps/backend/src/modules/banner/banner.controller.ts` | +86 | -3 |
| `apps/backend/src/modules/banner/banner.module.ts` | +8 | -2 |
| `apps/backend/src/modules/banner/banner.repository.ts` | +65 | -1 |
| `apps/backend/src/modules/banner/banner.service.spec.ts` | +208 | -0 |
| `apps/backend/src/modules/banner/banner.service.ts` | +72 | -2 |
| `apps/backend/src/modules/banner/dto/create-banner.dto.ts` | +50 | -0 |
| `apps/backend/src/modules/banner/dto/update-banner.dto.ts` | +44 | -0 |
| `apps/backend/src/modules/order/order.repository.ts` | +55 | -0 |
| `apps/backend/src/modules/order/order.service.ts` | +25 | -0 |
| `apps/backend/src/modules/seller/seller.repository.ts` | +13 | -0 |
| `apps/backend/src/modules/seller/seller.service.ts` | +12 | -0 |
| `apps/backend/src/modules/stats/stats.controller.ts` | +33 | -3 |
| `apps/backend/src/modules/stats/stats.module.ts` | +10 | -2 |
| `apps/backend/src/modules/stats/stats.repository.ts` | +5 | -0 |
| `apps/backend/src/modules/stats/stats.service.spec.ts` | +117 | -0 |
| `apps/backend/src/modules/stats/stats.service.ts` | +54 | -1 |
| `apps/backend/src/modules/user/user.module.ts` | +1 | -0 |
| `apps/backend/src/modules/user/user.repository.ts` | +15 | -0 |
| `apps/backend/src/modules/user/user.service.ts` | +36 | -0 |
| `apps/backend/test/banner-admin.e2e-spec.ts` | +163 | -0 |
| `apps/backend/test/static/auth-required-guards.spec.ts` | +8 | -0 |
| `apps/backend/test/static/cross-schema.spec.ts` | +40 | -0 |

**합계 (apps/backend)**: 30 files changed, 1384 insertions(+), 17 deletions(-).

> 본 007 SDD 문서 세트(`docs/specs/v1.0.0/007-banner-stats-admin/**`) 와 `CHANGES.md` 의 007 항목은 `7a9ed2c` 코드 커밋 **이후** retroactive 로 별도 추가되었다(코드 diff 범위 외).

## Diff

> 전체 diff 는 본 문서에 박제하지 않는다 — **git 이 형상관리 SoT** 이며 전체 캡처는 중복·비효율이다.
> 변경 내용은 위 "변경 요약" · "변경 파일 및 라인 수" 절로 추적하고, 라인 단위 diff 가 필요하면 아래로 재생성한다:
>
> ```bash
> git diff 3df34ac 7a9ed2c -- apps/backend   # base commit: 3df34ac (006 SDD 문서 커밋)
> ```
