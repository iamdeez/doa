---
작성: Docs Agent
버전: v1.0
최종 수정: 2026-06-29 17:50
상태: 확정 (retroactive)
---

# Diff: 006-search-notification-file

## 커밋 메시지용 한 줄 요약

(이 섹션은 커밋 메시지 작성 시 참고용이다. 실제 커밋 메시지는 프로젝트 컨벤션에 맞춰 조정한다.)

- **KO**: 검색·알림·파일 모듈 실구현 및 product 모듈 006 검색 메서드 추가
- **EN**: implement search, notification & file modules with product searchProducts integration

## 변경 요약

- **Prisma 스키마**: `NotificationType`(users)·`FilePurpose`·`FileStatus`(files) 3개 enum, `Notification`(users 스키마)·`FileAsset`(신규 files 스키마, `@@map("files")`) 2개 모델 추가. `notifications(userId, isRead, createdAt desc)` 인덱스, `file_assets.key @unique` + `(ownerId, createdAt desc)` 인덱스. cross-schema 참조(`notifications.userId`·`file_assets.ownerId`)는 plain String(FK 미선언, P-001). **금전 필드 없음**(P-005 해당 없음).
- **search 모듈 스텁 → 실구현**: SearchService(page/size 정규화·size 클램핑 20/100·sort 기본 latest → ProductService DI 위임), SearchController(GET /search/products — 공개), SearchRepository(빈 클래스 — 자체 테이블 없음, providers 미등록), 상수(DEFAULT/MAX_SEARCH_SIZE·SEARCH_SORTS), dto.
- **notification 모듈 스텁 → 실구현**: NotificationRepository(create·findById·listByUser 미읽음 우선·markRead·markAllRead), NotificationService(create 공개 진입점·list·markRead 소유권 404/403·markAllRead), NotificationController(GET /·PATCH /read-all·PATCH /:id/read — JwtAuthGuard). NotificationService export.
- **file 모듈 스텁 → 실구현**: FileStoragePort 인터페이스 + StubFileStorage(무네트워크 결정적 URL `https://r2.stub.local/{key}`, FILE_STORAGE 토큰), FileRepository(create·findById·delete), FileService(presign — key {purpose}/{userId}/{uuid}·PENDING 레코드, getById 404, delete 소유권 404/403), FileController(POST /presign 201·GET /:id·DELETE /:id 204 — JwtAuthGuard). FileService export.
- **product 모듈 006 연동(additive 공개)**: `ProductService.searchProducts`(가격 입력 Prisma.Decimal 변환) + `ProductRepository.searchProducts`(status `in [ACTIVE, OUT_OF_STOCK]`·title contains insensitive·DecimalFilter 가격·정렬 tiebreaker id desc·images include) 신규. 기존 메서드 시그니처 불변(002~005 회귀 0).
- **테스트 추가**: search.service.spec(5 케이스 — SC-001/002), notification.service.spec(8 케이스 — SC-004/005/006/007), file.service.spec(7 케이스 — SC-008/009/010), search-notification-file.e2e(4 케이스 — AppModule 부팅·라우트, SC-011), cross-schema.spec(NotificationRepository·FileRepository 규칙, SC-053).

## 변경 파일 및 라인 수

> 범위: `apps/backend`. base `b174133`(005 완료) → `f2f061a`(006 완료).

| 파일 | 추가 | 삭제 |
|---|---|---|
| `apps/backend/prisma/migrations/20260629081946_006_search_notification_file/migration.sql` | +45 | -0 |
| `apps/backend/prisma/schema.prisma` | +72 | -0 |
| `apps/backend/src/modules/file/dto/presign.dto.ts` | +11 | -0 |
| `apps/backend/src/modules/file/file-storage.port.ts` | +21 | -0 |
| `apps/backend/src/modules/file/file.controller.ts` | +48 | -3 |
| `apps/backend/src/modules/file/file.module.ts` | +15 | -1 |
| `apps/backend/src/modules/file/file.repository.ts` | +28 | -1 |
| `apps/backend/src/modules/file/file.service.spec.ts` | +146 | -0 |
| `apps/backend/src/modules/file/file.service.ts` | +76 | -2 |
| `apps/backend/src/modules/file/stub-file-storage.ts` | +32 | -0 |
| `apps/backend/src/modules/notification/dto/list-notifications.dto.ts` | +17 | -0 |
| `apps/backend/src/modules/notification/notification.constants.ts` | +5 | -0 |
| `apps/backend/src/modules/notification/notification.controller.ts` | +43 | -3 |
| `apps/backend/src/modules/notification/notification.module.ts` | +7 | -0 |
| `apps/backend/src/modules/notification/notification.repository.ts` | +59 | -1 |
| `apps/backend/src/modules/notification/notification.service.spec.ts` | +138 | -0 |
| `apps/backend/src/modules/notification/notification.service.ts` | +76 | -2 |
| `apps/backend/src/modules/product/product.repository.ts` | +47 | -0 |
| `apps/backend/src/modules/product/product.service.ts` | +25 | -0 |
| `apps/backend/src/modules/search/dto/search-products.dto.ts` | +48 | -0 |
| `apps/backend/src/modules/search/search.constants.ts` | +9 | -0 |
| `apps/backend/src/modules/search/search.controller.ts` | +13 | -2 |
| `apps/backend/src/modules/search/search.module.ts` | +7 | -2 |
| `apps/backend/src/modules/search/search.repository.ts` | +6 | -0 |
| `apps/backend/src/modules/search/search.service.spec.ts` | +101 | -0 |
| `apps/backend/src/modules/search/search.service.ts` | +50 | -1 |
| `apps/backend/test/search-notification-file.e2e-spec.ts` | +81 | -0 |
| `apps/backend/test/static/cross-schema.spec.ts` | +27 | -0 |

**합계 (apps/backend)**: 28 files changed, 1253 insertions(+), 18 deletions(-).

> 본 006 SDD 문서 세트(`docs/specs/v1.0.0/006-search-notification-file/**`) 와 `CHANGES.md` 의 006 항목은 `f2f061a` 코드 커밋 **이후** retroactive 로 별도 추가되었다(코드 diff 범위 외).

## Diff

> 전체 diff 는 본 문서에 박제하지 않는다 — **git 이 형상관리 SoT** 이며 전체 캡처는 중복·비효율이다.
> 변경 내용은 위 "변경 요약" · "변경 파일 및 라인 수" 절로 추적하고, 라인 단위 diff 가 필요하면 아래로 재생성한다:
>
> ```bash
> git diff b174133 f2f061a -- apps/backend   # base commit: b174133 (005 완료)
> ```
