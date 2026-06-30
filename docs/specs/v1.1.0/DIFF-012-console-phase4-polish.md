---
작성: Docs Agent
버전: v1.0
최종 수정: 2026-06-30 19:20
상태: 확정
---

# Diff: 012-console-phase4-polish

## 커밋 메시지용 한 줄 요약

(이 섹션은 커밋 메시지 작성 시 참고할 수 있도록 제공한다. 실제 커밋 메시지는 프로젝트 컨벤션에 맞게 자유롭게 조정한다.)

- **KO**: 콘솔 Phase 4 마감 — isAdmin 백엔드 노출·ImageUpload·미들웨어 라우트 가드·표준 컴포넌트·Playwright
- **EN**: Console Phase 4 polish — backend isAdmin field, ImageUpload component, middleware route guard, standard state components, Playwright E2E setup

## 변경 요약

### 백엔드 (apps/backend)

- **`shared/auth/admin-ids.ts` 신규**: `isAdminUserId(userId, rawEnv)` 순수 헬퍼 추출. ADMIN_USER_IDS 파싱(콤마분리·trim·빈값필터) 로직을 AdminGuard·AuthService 가 공유하도록 단일 지점화(ADR-001). fail-closed(env 미설정 → false).
- **`admin.guard.ts` 리팩토링**: 인라인 파싱 로직 → `isAdminUserId()` 위임. 행위 보존.
- **`auth.service.ts` 수정**: `getProfile()` 반환에 `isAdmin: isAdminUserId(userId, env)` 추가(FR-001).
- **`auth-response.dto.ts` 수정**: `AuthProfileResponse`에 `isAdmin: boolean` 필드 추가.
- **`auth.service.spec.ts` 수정**: SC-001·SC-002 신규 테스트 10개. process.env 격리(beforeEach/afterEach). 기존 v1.0.0/001 spec SC 출처 주석 추가(STALE_SC 옵션 A).

### 콘솔 공용 (apps/console)

- **`lib/upload-constants.ts` 신규**: `ALLOWED_MIME_TYPES`·`MAX_FILE_SIZE_BYTES` 상수 — 백엔드 allowlist·10MiB 기준과 동기화(NFR-002).
- **`components/states.tsx` 신규**: `<LoadingState>·<ErrorState>·<EmptyState>` 표준 상태 컴포넌트(FR-008).
- **`components/image-upload.tsx` 신규**: `<ImageUpload>` 공용 컴포넌트 — presign→PUT→confirm 3단계 업로드 플로우. MIME·크기 클라이언트 검증 포함(FR-002·NFR-002·NFR-003·ADR-002).
- **`lib/auth.tsx` 수정**: `isAdmin` 하드코딩 false → `profile?.isAdmin ?? false`. 쿠키 미러링(`token` 쿠키 set/delete) 추가(FR-005·ADR-003·ADR-004).
- **`lib/config.ts` 신규**: `API_BASE_URL` 런타임 노출(ADR-006).
- **`middleware.ts` 신규**: Next.js 서버 사이드 라우트 가드. 비인증 → `/login` 리다이렉트. 비관리자 `/admin/*` → `/login` 차단(FR-006·ADR-003·ADR-005·NFR-004).

### 콘솔 페이지·레이아웃

- **`layout.tsx` 수정**: 네비게이션 admin 섹션에 `isAdmin` 조건 추가(FR-007. GAP-007-01 (2) 해소).
- **`admin/banners/page.tsx` 수정**: CreateBannerDialog `imageUrl` 텍스트 입력 → `<ImageUpload>` 교체(FR-004).
- **`seller/products/[id]/page.tsx` 수정**: 이미지 관리 섹션 추가 — 목록·업로드(`POST /products/:id/images`)·삭제(`DELETE /products/:id/images/:imageId`)·10장 제한(FR-003).

### 패키지

- **`shared-types/src/index.ts` 수정**: `FilePurpose` union(`'PRODUCT_IMAGE' | 'REVIEW_IMAGE' | 'PROFILE'`) 신규. `UserProfile.isAdmin: boolean` 추가. `ImageUploadResult` 신규.
- **`api-client/src/index.ts` 수정**: `files.presign·confirm`, `products.addImage·deleteImage` 메서드 추가.

### 설정·테스트

- `apps/console/package.json`: `@playwright/test`·`vitest`·`@vitejs/plugin-react` devDep 추가. `test` 스크립트 추가.
- `apps/console/tsconfig.json`: `paths` 추가, 테스트 파일 exclude.
- `apps/console/vitest.config.ts` 신규: vitest 설정(react plugin).
- `apps/console/vitest.setup.ts` 신규: vitest 글로벌 setup.
- `apps/console/tsconfig.test.json`·`tsconfig.e2e.json` 신규: 테스트/E2E 전용 tsconfig.
- `apps/console/playwright.config.ts` 신규: Playwright 설정(SC-020).
- `apps/console/static-verification.test.ts` 신규: 정적 구조 검증 24개.
- `apps/console/components/image-upload.test.tsx` 신규: ImageUpload 단위 테스트 7개(SC-004~006).
- `apps/console/app/(dashboard)/layout.test.tsx` 신규: 레이아웃 isAdmin 분기 3개(SC-017).
- `apps/console/app/(dashboard)/admin/banners/page.test.tsx` 신규: 배너 페이지 5개(SC-011·012·019).
- `apps/console/app/(dashboard)/seller/products/[id]/page.test.tsx` 신규: 상품 이미지 섹션 5개(SC-007~010).
- `apps/console/e2e/auth.spec.ts`·`seller.spec.ts`·`admin.spec.ts`·`guard.spec.ts` 신규: Playwright E2E 스모크(SC-021~025).
- `pnpm-lock.yaml`: Playwright + vitest 전이 의존성.

## 변경 파일 및 라인 수

수정 파일 (tracked):

| 파일 | 추가 | 삭제 |
|---|---|---|
| `apps/backend/src/modules/auth/auth.service.spec.ts` | +72 | -12 |
| `apps/backend/src/modules/auth/auth.service.ts` | +4 | -1 |
| `apps/backend/src/modules/auth/dto/auth-response.dto.ts` | +3 | -0 |
| `apps/backend/src/shared/auth/admin.guard.ts` | +4 | -7 |
| `apps/console/app/(dashboard)/admin/banners/page.tsx` | +17 | -2 |
| `apps/console/app/(dashboard)/layout.tsx` | +6 | -3 |
| `apps/console/app/(dashboard)/seller/products/[id]/page.tsx` | +85 | -1 |
| `apps/console/lib/auth.tsx` | +13 | -5 |
| `apps/console/lib/config.ts` | +10 | -0 |
| `apps/console/package.json` | +12 | -2 |
| `apps/console/tsconfig.json` | +9 | -1 |
| `packages/api-client/src/index.ts` | +13 | -0 |
| `packages/shared-types/src/index.ts` | +38 | -1 |
| `pnpm-lock.yaml` | +1176 | -17 |

신규 파일 (untracked):

| 파일 | 비고 |
|---|---|
| `apps/backend/src/shared/auth/admin-ids.ts` | isAdminUserId 헬퍼 |
| `apps/backend/src/shared/auth/admin-ids.spec.ts` | 헬퍼 단위 테스트 |
| `apps/console/components/image-upload.tsx` | ImageUpload 컴포넌트 |
| `apps/console/components/states.tsx` | 표준 상태 컴포넌트 |
| `apps/console/lib/upload-constants.ts` | 업로드 상수 |
| `apps/console/lib/config.ts` | API_BASE_URL 설정 |
| `apps/console/middleware.ts` | Next.js 라우트 가드 |
| `apps/console/playwright.config.ts` | Playwright 설정 |
| `apps/console/vitest.config.ts` | vitest 설정 |
| `apps/console/vitest.setup.ts` | vitest setup |
| `apps/console/tsconfig.test.json` | 테스트 tsconfig |
| `apps/console/tsconfig.e2e.json` | E2E tsconfig |
| `apps/console/static-verification.test.ts` | 정적 검증 24개 |
| `apps/console/components/image-upload.test.tsx` | ImageUpload 테스트 7개 |
| `apps/console/app/(dashboard)/layout.test.tsx` | 레이아웃 테스트 3개 |
| `apps/console/app/(dashboard)/admin/banners/page.test.tsx` | 배너 테스트 5개 |
| `apps/console/app/(dashboard)/seller/products/[id]/page.test.tsx` | 상품 이미지 테스트 5개 |
| `apps/console/e2e/auth.spec.ts` | Playwright E2E 로그인 |
| `apps/console/e2e/seller.spec.ts` | Playwright E2E 판매자 |
| `apps/console/e2e/admin.spec.ts` | Playwright E2E 관리자 |
| `apps/console/e2e/guard.spec.ts` | Playwright E2E 가드 |

**합계**: 14 files modified + 21 files untracked = 35 files, tracked +1462/-52

## Diff

> 전체 diff 는 박제하지 않는다 — git 이 형상관리 SoT. base commit + 재생성 명령만 기록:

```
git diff f0489a1 -- apps/backend/src apps/console packages/shared-types packages/api-client pnpm-lock.yaml
```

> 신규 파일(untracked) 포함 시:
> ```
> git diff f0489a1 -- apps/backend/src apps/console packages/shared-types packages/api-client pnpm-lock.yaml && git ls-files --others --exclude-standard apps/backend/src apps/console
> ```
