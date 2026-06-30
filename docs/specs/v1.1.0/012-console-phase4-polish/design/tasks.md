---
작성: Design Agent
버전: v1.0
최종 수정: 2026-06-30 17:44
상태: 확정
---

# Tasks: 012-console-phase4-polish

> Branch: 012-console-phase4-polish | Date: 2026-06-30 | Plan: [plan.md](../planning/plan.md)

## 목차

- [전제 조건](#전제-조건)
- [태스크 목록](#태스크-목록)
  - [Step 1. 기반 작업](#step-1-기반-작업)
  - [Step 2. 핵심 구현](#step-2-핵심-구현)
  - [Step 3. 테스트 (D 레이어 — 5a Test Agent)](#step-3-테스트-d-레이어--5a-test-agent)
- [Test Authoring Contract](#test-authoring-contract)
- [태스크 입도 가이드](#태스크-입도-가이드)
- [구현 완료 기준](#구현-완료-기준)

---

## 전제 조건

- [x] spec.md 의 모든 [NEEDS CLARIFICATION] 항목이 해소되었는가? — 0건(spec 확정)
- [x] plan.md 의 Constitution Gates(P-001~P-007)가 모두 통과되었는가? — 전체 PASS
- [x] CHANGES.md 에서 이전 작업의 "후속 작업 시 주의사항" 을 확인했는가? — GAP-007-01(isAdmin 하드코딩) 본 spec 이 해소 대상
- [x] GAP-001(FilePurpose BANNER 부재) RESOLVED, GAP-002(context.md 현행화) OPEN(6단계 위임) — [gaps.md](../gaps.md)

---

## 태스크 목록

> [P]: 직전 태스크와 병렬 실행 가능.
> **레이어 분해** (PPG-1 책임 분할):
>
> | 레이어 | 대상 | PPG-1 책임 |
> |---|---|---|
> | A. 데이터 계층 | DB 스키마/마이그레이션 | **없음**(DB 변경 0건 — plan 데이터 모델) |
> | B. 도메인 계층 | 백엔드 비즈니스 로직 + 공유 타입 | 4단계 Development |
> | C. 인터페이스 계층 | api-client + console UI/컴포넌트/미들웨어 | 4단계 Development |
> | D. 테스트 계층 | 테스트 러너·단위/통합/정적/E2E 테스트 | **5a Test Agent (AUTHORING)** |
>
> 기본 의존 순서: B → C, D 는 4단계와 PPG-1 병렬. `apps/console/package.json` 의 테스트 devDependency·script 는 **D 레이어(5a) 단독 소유**(playwright·vitest 모두) — 4단계는 production 코드만 수정하여 산출물 충돌 0.

### Step 1. 기반 작업

- [x] **T001** — 공유 타입 추가 (shared-types)
  - 레이어: B
  - 구현 파일: `packages/shared-types/src/index.ts`
  - 관련 요구사항: FR-001, FR-002
  - 상세:
    - `UserProfile` 에 `isAdmin?: boolean;` 추가(`GET /auth/me` 채움, `GET /users/me` 미채움이므로 optional — 하위 호환).
    - `FilePurpose` 문자열 union 신규: `export type FilePurpose = 'PRODUCT_IMAGE' | 'REVIEW_IMAGE' | 'PROFILE';` (Prisma enum 동기 — console 은 @prisma/client import 불가, GAP-001).
    - presign/confirm/파일 타입 신규: `PresignRequest { purpose: FilePurpose; contentType: string }`, `PresignResult { id: string; key: string; uploadUrl: string; url: string }`, `ConfirmFileRequest { size: number }`, `FileAsset { id: string; key: string; url: string; contentType: string; size: number; status: 'PENDING' | 'UPLOADED' }`.
  - 완료 기준: 타입 추가, `pnpm --filter @doa/shared-types build`(또는 typecheck) 통과. 기존 타입 시그니처 불변.

- [x] **T002** `[P]` — AdminGuard 파싱 헬퍼 추출 (행위 보존, ADR-001)
  - 레이어: B
  - 구현 파일: `apps/backend/src/shared/auth/admin-ids.ts`(신규), `apps/backend/src/shared/auth/admin.guard.ts`(수정)
  - 관련 요구사항: FR-001
  - 상세:
    - `admin-ids.ts`: 순수 함수 `export function isAdminUserId(userId: string, rawEnv: string | undefined): boolean` — `(rawEnv ?? '').split(',').map(trim).filter(len>0)` → `adminIds.length === 0 ? false : adminIds.includes(userId)` (fail-closed).
    - `admin.guard.ts`: 인라인 파싱(L26-34)을 `isAdminUserId(user.userId, process.env['ADMIN_USER_IDS'])` 호출로 교체. **행위 보존**(동일 입출력).
  - 완료 기준: AdminGuard.canActivate 동작 불변(기존 `admin.guard.spec.ts` PASS 유지), 헬퍼 export.

- [x] **T004** — api-client `files` 그룹 + `catalog.deleteImage` 추가
  - 레이어: C
  - 구현 파일: `packages/api-client/src/index.ts`
  - 관련 요구사항: FR-002, FR-003
  - 상세 (의존: T001):
    - `files` 그룹 신규: `presign(body: PresignRequest) → http.post<PresignResult>('/files/presign', body)`, `confirm(id: string, size: number) → http.post<FileAsset>('/files/' + id + '/confirm', { size })`.
    - `catalog.deleteImage(productId, imageId) → http.delete<void>('/products/' + productId + '/images/' + imageId)`.
    - import 추가: `PresignRequest`·`PresignResult`·`FileAsset`(`@doa/shared-types`).
  - 완료 기준: 두 메서드 호출 가능, 기존 메서드 시그니처 불변, typecheck 통과.

- [x] **T005** `[P]` — 업로드 상수 모듈 + 표준 상태 컴포넌트 (FR-008)
  - 레이어: C
  - 구현 파일: `apps/console/lib/upload-constants.ts`(신규), `apps/console/components/states.tsx`(신규)
  - 관련 요구사항: FR-002(NFR-002), FR-008
  - 상세:
    - `upload-constants.ts`: `export const ALLOWED_IMAGE_TYPES = ['image/jpeg','image/png','image/webp','image/gif'] as const;` `export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;` (백엔드 `file.constants.ts` 동일 값 — 매직넘버 금지, NFR-002).
    - `states.tsx`: `export function LoadingState({ label }: { label?: string })`, `export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void })`(ApiError 메시지 추출 + 403 분기 안내), `export function EmptyState({ title, message, action }: { title: string; message?: string; action?: ReactNode })`. `@doa/ui` 프리미티브(`Loading`/`ErrorText`) 래핑. **동명 `EmptyState`(@doa/ui) 충돌 — import 경로 `@/components/states` 로 구분.**
  - 완료 기준: 3개 컴포넌트 export, 상수 2종 정의, typecheck 통과.

### Step 2. 핵심 구현

- [x] **T003** — auth.service getProfile isAdmin + DTO (FR-001)
  - 레이어: B
  - 구현 파일: `apps/backend/src/modules/auth/auth.service.ts`(수정), `apps/backend/src/modules/auth/dto/auth-response.dto.ts`(수정)
  - 관련 요구사항: FR-001
  - 상세 (의존: T001, T002):
    - `auth.service.ts`: 모듈 로컬 `UserProfile` 인터페이스(L27)에 `isAdmin: boolean` 추가. `getProfile` 에서 `const isAdmin = isAdminUserId(userId, process.env['ADMIN_USER_IDS'])` → 반환 객체에 포함(`{ id, email, createdAt, isAdmin }`). `admin-ids.ts` import.
    - `auth-response.dto.ts`: `AuthProfileResponse` 에 `@ApiProperty() isAdmin!: boolean;` 추가.
  - 완료 기준: `GET /auth/me` 응답에 isAdmin 포함, 기존 백엔드 테스트 PASS 유지(SC-003 전제), `auth.controller.ts` 무변경 확인.

- [x] **T006** — `<ImageUpload>` 공용 컴포넌트 (FR-002)
  - 레이어: C
  - 구현 파일: `apps/console/components/image-upload.tsx`(신규)
  - 관련 요구사항: FR-002(NFR-002, NFR-003)
  - 상세 (의존: T004, T005, T001):
    - props: `{ purpose: FilePurpose; onUploaded: (publicUrl: string) => void; disabled?: boolean }`.
    - `<input type="file" accept="image/*">` 선택 → 클라이언트 검증: `file.type ∉ ALLOWED_IMAGE_TYPES` 또는 `file.size > MAX_IMAGE_BYTES` → presign 미호출 + `<ErrorState>` 메시지(SC-005).
    - 3단계: `api.files.presign({ purpose, contentType: file.type })` → `fetch(uploadUrl, { method:'PUT', headers:{'Content-Type':file.type}, body:file })`(**plain fetch — authFetch 아님**, 비-2xx → PUT 오류) → `api.files.confirm(id, file.size)` → 성공 시 `onUploaded(url)`(presign 의 url=public URL).
    - 각 단계 try/catch → 단계별 `<ErrorState>`(NFR-003 silent fail 금지, SC-006). 업로드 중 `<LoadingState>`. 업로드 후 `input.value=''` reset(동일 파일 재선택).
  - 완료 기준: 3단계 순서 호출·검증 차단·단계별 오류 표시 동작. typecheck 통과.

- [x] **T007** — 상품 상세 이미지 관리 섹션 (FR-003, FR-009)
  - 레이어: C
  - 구현 파일: `apps/console/app/(dashboard)/seller/products/[id]/page.tsx`(수정)
  - 관련 요구사항: FR-003, FR-009
  - 상세 (의존: T006, T004, T005):
    - `detail.data` 블록(L61-75) 내에 `<ProductImageSection>` 추가(한계 L1 — ACTIVE/OUT_OF_STOCK 만). `detail.data.images ?? []` 로 썸네일 그리드 렌더. 0장 → `<EmptyState>`.
    - 추가: `<ImageUpload purpose="PRODUCT_IMAGE" disabled={images.length >= 10} onUploaded={(url) => addImage.mutate({ url, displayOrder: images.length })} />`. `addImage` mutation → `api.catalog.addImage(productId, {url, displayOrder})` → onSuccess `refetchAll`.
    - 삭제: 각 이미지 삭제 버튼 → `api.catalog.deleteImage(productId, imageId)` → onSuccess `refetchAll`.
    - 10장 시 버튼 비활성(SC-010) + 안내 문구. 로딩/에러 → 표준 컴포넌트(FR-009).
  - 완료 기준: 이미지 목록·추가·삭제·10장 비활성 동작, 표준 컴포넌트 적용. typecheck 통과.

- [x] **T008** — 배너 생성 다이얼로그 ImageUpload 교체 (FR-004, FR-009)
  - 레이어: C
  - 구현 파일: `apps/console/app/(dashboard)/admin/banners/page.tsx`(수정)
  - 관련 요구사항: FR-004, FR-009
  - 상세 (의존: T006, T005):
    - CreateBannerDialog 의 `imageUrl` 텍스트 `<Input>`(L147) → `<ImageUpload purpose="PRODUCT_IMAGE" onUploaded={(url) => setForm(s => ({...s, imageUrl: url}))} />` + 업로드된 URL 미리보기.
    - 제출 시 `body.imageUrl = form.imageUrl`(업로드 public URL) — 기존 createBanner 흐름 유지. 기존 `disabled={... || !form.imageUrl}`(L164)가 업로드 전 제출 차단.
    - 업로드 실패 → `<ErrorState>`(FR-009). banner 페이지 기존 `@doa/ui` import 중 표준 컴포넌트 적용분은 `@/components/states` 로 교체(동명 EmptyState import 경로 구분).
  - 완료 기준: imageUrl 영역이 ImageUpload, 업로드 URL 이 createBanner body 로 전송. typecheck 통과.

- [x] **T009** — auth.tsx isAdmin + 쿠키 미러링 + config 쿠키 키 (FR-005, FR-006)
  - 레이어: C
  - 구현 파일: `apps/console/lib/auth.tsx`(수정), `apps/console/lib/config.ts`(수정)
  - 관련 요구사항: FR-005, FR-006(ADR-003)
  - 상세 (의존: T001):
    - `config.ts`: `export const COOKIE_KEYS = { auth: 'doa_console_auth', admin: 'doa_console_admin' } as const;` (매직스트링 금지).
    - `auth.tsx`: `value.isAdmin` 을 `profile?.isAdmin ?? false`(L107 `isAdmin: false` 교체). `hydrate()` 의 `me` 수신 직후(동일 가드 — me 존재 분기에서 **두 쿠키 함께 기록**, §E): `document.cookie = COOKIE_KEYS.auth + '=1; Path=/; SameSite=Lax'`, `document.cookie = COOKIE_KEYS.admin + '=' + (me.isAdmin ? 'true':'false') + '; Path=/; SameSite=Lax'`. `logout()` 에서 두 쿠키 `Max-Age=0` 제거. 주석(L24-29) 갱신.
  - 완료 기준: isAdmin 이 profile 값 반영, login/logout 시 쿠키 기록·제거. typecheck 통과.

- [x] **T010** — middleware.ts 라우트 가드 (FR-006)
  - 레이어: C
  - 구현 파일: `apps/console/middleware.ts`(신규)
  - 관련 요구사항: FR-006(NFR-004, ADR-006)
  - 상세 (의존: T009 — COOKIE_KEYS):
    - `config.matcher` 보호 경로: `/dashboard/:path*`, `/account/:path*`, `/seller/:path*`, `/admin/:path*`(로그인·정적 자원 제외).
    - 로직: `auth` 쿠키 부재 → `NextResponse.redirect(new URL('/login', req.url))`(SC-015). `/admin/*` + (`auth` 부재 OR `admin` !== 'true') → `/login` 리다이렉트(SC-016, 403 대신 — ADR-006).
    - 주석: middleware = UX 계층, 실제 인가 = 백엔드 AdminGuard(L2 명시).
  - 완료 기준: 파일 존재·matcher 설정·리다이렉트 로직. typecheck 통과.

- [x] **T011** `[P]` — 대시보드 nav admin 필터 (FR-007)
  - 레이어: C
  - 구현 파일: `apps/console/app/(dashboard)/layout.tsx`(수정)
  - 관련 요구사항: FR-007
  - 상세 (의존: T009 — useAuth isAdmin):
    - `useAuth()` 구조분해에 `isAdmin` 추가. `visible` 필터(L53): `NAV.filter((n) => (n.section !== 'seller' || isSeller) && (n.section !== 'admin' || isAdmin))`. L52 주석 갱신.
  - 완료 기준: isAdmin=false 시 admin 섹션 항목 미표시. typecheck 통과.

### Step 3. 테스트 (D 레이어 — 5a Test Agent)

> 본 Step 의 모든 태스크는 **5a 단계 Test Agent (AUTHORING)** 가 PPG-1 시작 시 4단계와 병렬 수행. Development Agent(4단계)는 본 Step 외 태스크(B·C)만 진행. `apps/console/package.json` 테스트 devDependency·script 는 본 Step(D) 단독 소유.
> `[env:e2e-docker]` SC(015·016·021~025)는 **테스트 파일 작성은 포함하되 실행은 사용자 로컬 defer**(옵션 A — main session 사용자 결정).

- [ ] **T012** — 백엔드 단위 테스트: isAdmin (SC-001·002·003)
  - 레이어: D
  - 테스트 파일: `apps/backend/src/modules/auth/auth.service.spec.ts`(추가), `apps/backend/src/shared/auth/admin-ids.spec.ts`(신규)
  - 검증 대상: SC-001, SC-002, SC-003
  - 상세: `getProfile` 반환에 `isAdmin: boolean` 포함(SC-001). `ADMIN_USER_IDS` 포함→true / 미포함→false / 미설정→false(SC-002, `process.env` 변형). `admin-ids.spec.ts` 로 `isAdminUserId` 단위 검증. SC-003 = 기존 백엔드 스위트 전량 PASS + 신규 추가(러너: 기존 Jest).
  - 완료 기준: `pnpm --filter backend test` 전체 PASS(기존 261 + 신규).

- [ ] **T013** — console 단위/통합 테스트 러너 구성 (vitest + RTL)
  - 레이어: D
  - 구현 파일: `apps/console/package.json`(devDep + script), `apps/console/vitest.config.ts`(신규), `apps/console/vitest.setup.ts`(신규, 선택)
  - 관련 요구사항: FR-002·FR-003 테스트 전제(plan 기타 고려사항)
  - 상세: `vitest` + `@testing-library/react` + `@testing-library/jest-dom` + `jsdom` devDependency. `vitest.config.ts`(environment jsdom, alias `@/`). `"test": "vitest run"` script. **T014~T019 의 console 테스트 실행 전제.**
  - 완료 기준: `pnpm --filter console test` 가 빈 스위트라도 러너 기동 성공.

- [ ] **T014** — ImageUpload 단위 테스트 (SC-004·005·006)
  - 레이어: D
  - 테스트 파일: `apps/console/components/image-upload.test.tsx`(신규)
  - 검증 대상: SC-004, SC-005, SC-006
  - 상세 (의존: T013 러너): fetch/api mock 으로 3단계 순서 호출(presign→PUT→confirm→onUploaded, SC-004). MIME 불허/10MiB 초과 시 presign 미호출 + 오류(SC-005). presign/PUT/confirm 각 단계 reject → 단계별 오류(SC-006).
  - 완료 기준: 3개 SC 시나리오 PASS.

- [ ] **T015** — 상품 이미지 섹션 통합 테스트 (SC-007·008·009·010)
  - 레이어: D
  - 테스트 파일: `apps/console/app/(dashboard)/seller/products/[id]/page.test.tsx`(신규, 또는 섹션 컴포넌트 단위)
  - 검증 대상: SC-007(목록 렌더), SC-008(POST images 호출), SC-009(DELETE 호출), SC-010(10장 비활성)
  - 상세 (의존: T013): images 포함 detail mock → 썸네일 렌더(SC-007). 업로드 onUploaded → `addImage` → `POST /products/:id/images {url,displayOrder}`(SC-008). 삭제 클릭 → `DELETE /products/:id/images/:imageId`(SC-009). `images.length===10` → 추가 버튼 disabled(SC-010, unit).
  - 완료 기준: 4개 SC PASS.

- [ ] **T016** — 배너 통합 + 표준 컴포넌트 적용 테스트 (SC-012·019)
  - 레이어: D
  - 테스트 파일: `apps/console/app/(dashboard)/admin/banners/page.test.tsx`(신규)
  - 검증 대상: SC-012(업로드 URL → createBanner body), SC-019(변경 페이지 로딩·에러·빈상태 표준 컴포넌트)
  - 상세 (의존: T013): 업로드 완료 후 제출 → createBanner body.imageUrl = public URL(SC-012). 상품/배너 페이지 로딩·에러·빈상태가 각각 `<LoadingState>`/`<ErrorState>`/`<EmptyState>` 렌더(SC-019).
  - 완료 기준: 2개 SC PASS.

- [ ] **T017** `[P]` — nav admin 필터 단위 테스트 (SC-017)
  - 레이어: D
  - 테스트 파일: `apps/console/app/(dashboard)/layout.test.tsx`(신규)
  - 검증 대상: SC-017
  - 상세 (의존: T013): `useAuth` mock `isAdmin=false` → admin 섹션 NAV 항목 미표시. `isAdmin=true` → 표시.
  - 완료 기준: SC-017 PASS.

- [ ] **T018** `[P]` — 정적 검증 테스트 (SC-011·013·014·018·020)
  - 레이어: D
  - 테스트 파일: `apps/console/e2e/` 또는 정적 검사 스크립트 (Test Agent 결정 — grep/파일 존재 단언)
  - 검증 대상: SC-011, SC-013, SC-014, SC-018, SC-020
  - 상세: SC-011(banner 페이지에 `<ImageUpload>` 사용·텍스트 input 제거 grep), SC-013(auth.tsx `false` 하드코딩 제거 + `profile?.isAdmin` 사용 grep), SC-014(`apps/console/middleware.ts` 존재 + `config.matcher`), SC-018(`components/states.tsx` 에 3개 export 존재), SC-020(`@playwright/test` devDep + `playwright.config.ts` 존재).
  - 완료 기준: 5개 정적 SC 단언 PASS(4단계 C 산출물 생성 후 Green).

- [ ] **T019** — Playwright 설치·설정 + E2E 스모크 파일 (SC-015·016·020·021·022·023·024·025)
  - 레이어: D
  - 구현 파일: `apps/console/package.json`(@playwright/test devDep + `"e2e": "playwright test"`), `apps/console/playwright.config.ts`(신규), `apps/console/e2e/{auth,seller,admin,guard}.spec.ts`(신규)
  - 검증 대상: SC-020(정적), SC-015·016·021·022·023·024·025(e2e-docker — **작성 포함, 실행 사용자 로컬 defer**)
  - 상세: `playwright.config.ts`(baseURL `http://localhost:3100`, testDir `./e2e`, timeout 합산 ≤2분 NFR-005). 4 시나리오: `auth.spec.ts`(로그인→대시보드 SC-021), `seller.spec.ts`(판매자→/seller/products SC-022), `admin.spec.ts`(관리자→/admin/banners SC-023), `guard.spec.ts`(비인증→/login SC-015·024, 비관리자→/admin/* 차단 SC-016). SC-025 = 러너 리포트 실행시간 측정.
  - 완료 기준: devDep+config 존재(SC-020 Green), 4 spec 파일 작성 완료. **실행 결과는 main session 이 사용자 로컬 실행 절차 제시 후 수집 → Test Agent 검증**(옵션 A).

---

## Test Authoring Contract

> **PPG-1 의 5a 단계 Test Agent (AUTHORING) 입력 contract**. 외부 agent/사용자/CI 가 직접 충족 가능.
> [env] 범례: unit=격리 단위, integration=컴포넌트+상호작용, static=파일/소스 grep, e2e-docker=실 stack(실행 defer).

### Canonical production 심볼 (PROC-004 — 가정 불일치 차단)

| 심볼 | 위치 | 시그니처 |
|---|---|---|
| `isAdminUserId` | `apps/backend/src/shared/auth/admin-ids.ts` | `(userId: string, rawEnv: string \| undefined) => boolean` |
| `AuthService.getProfile` | `apps/backend/src/modules/auth/auth.service.ts` | `(userId: string) => Promise<{ id; email; createdAt; isAdmin: boolean }>` |
| `api.files.presign` | `packages/api-client/src/index.ts` | `(body: { purpose: FilePurpose; contentType: string }) => Promise<{ id; key; uploadUrl; url }>` |
| `api.files.confirm` | 동상 | `(id: string, size: number) => Promise<FileAsset>` |
| `api.catalog.addImage` | 동상(기존) | `(productId: string, body: { url: string; displayOrder?: number }) => Promise<ProductImage>` |
| `api.catalog.deleteImage` | 동상(신규) | `(productId: string, imageId: string) => Promise<void>` |
| `<ImageUpload>` | `apps/console/components/image-upload.tsx` | props `{ purpose: FilePurpose; onUploaded: (publicUrl: string) => void; disabled?: boolean }` |
| `<LoadingState>` / `<ErrorState>` / `<EmptyState>` | `apps/console/components/states.tsx` | `{ label? }` / `{ error: unknown; onRetry? }` / `{ title: string; message?; action? }` |
| `COOKIE_KEYS` | `apps/console/lib/config.ts` | `{ auth: 'doa_console_auth'; admin: 'doa_console_admin' }` |
| 상수 | `apps/console/lib/upload-constants.ts` | `ALLOWED_IMAGE_TYPES`(4종) · `MAX_IMAGE_BYTES`(10*1024*1024) |

> `purpose` 값은 상품·배너 모두 `'PRODUCT_IMAGE'`(GAP-001 — FilePurpose enum 에 BANNER 부재, key prefix 전용). 리터럴 단언 시 production 상수/Canonical 참조(추측 금지).

### SC ↔ 테스트 매핑

| SC-ID | 수용 기준 | Happy | Edge | Error | 테스트 파일 경로 | env / 비고 |
|---|---|---|---|---|---|---|
| SC-001 | getProfile 응답에 isAdmin | test_when_valid_user_then_profile_has_isAdmin | — | — | `apps/backend/src/modules/auth/auth.service.spec.ts` | unit(Jest) |
| SC-002 | env 포함→true/미포함→false/미설정→false | test_when_admin_id_then_true | test_when_env_unset_then_false | test_when_not_in_list_then_false | 동상 + `admin-ids.spec.ts` | unit |
| SC-003 | 기존 261 PASS + 신규 추가 | (회귀 전량) | — | — | (전체 스위트) | unit |
| SC-004 | 3단계 순서 호출 | test_when_valid_file_then_presign_put_confirm | — | — | `apps/console/components/image-upload.test.tsx` | unit(vitest+RTL, T013 전제) |
| SC-005 | MIME 불허/10MiB 초과 차단 | — | test_when_bad_mime_then_no_presign / test_when_oversize_then_no_presign | — | 동상 | unit |
| SC-006 | 단계별 실패 메시지 | — | — | test_when_presign_fails / test_when_put_fails / test_when_confirm_fails | 동상 | unit |
| SC-007 | 이미지 섹션·목록 렌더 | test_when_images_then_grid_rendered | — | — | `apps/console/app/(dashboard)/seller/products/[id]/page.test.tsx` | integration |
| SC-008 | 업로드 후 POST images | test_when_uploaded_then_post_images | — | — | 동상 | integration |
| SC-009 | 삭제 → DELETE | test_when_delete_click_then_delete_image | — | — | 동상 | integration |
| SC-010 | 10장 시 추가 비활성 | — | test_when_ten_images_then_upload_disabled | — | 동상 | unit |
| SC-011 | banner 폼 ImageUpload | test_banner_form_uses_image_upload | — | — | (정적 grep) | static |
| SC-012 | 배너 생성 업로드 URL 전송 | test_when_uploaded_then_create_banner_image_url | — | — | `apps/console/app/(dashboard)/admin/banners/page.test.tsx` | integration |
| SC-013 | auth.tsx isAdmin=profile 값 | test_auth_tsx_uses_profile_isAdmin | — | — | (정적 grep) | static |
| SC-014 | middleware.ts 존재 + 패턴 | test_middleware_exists_with_matcher | — | — | (정적) | static |
| SC-015 | 비인증 → /login | — | — | test_when_unauth_protected_then_login | `apps/console/e2e/guard.spec.ts` | e2e-docker(실행 defer) |
| SC-016 | 비관리자 /admin/* 차단 | — | — | test_when_nonadmin_admin_then_blocked | 동상 | e2e-docker(defer) |
| SC-017 | nav admin 항목 숨김 | test_when_admin_then_admin_nav_shown | test_when_not_admin_then_admin_nav_hidden | — | `apps/console/app/(dashboard)/layout.test.tsx` | unit |
| SC-018 | states.tsx 3개 존재 | test_states_components_exist | — | — | (정적) | static |
| SC-019 | 변경 페이지 표준 컴포넌트 | test_changed_pages_use_state_components | — | — | banner/product page.test.tsx | integration |
| SC-020 | playwright devDep + config | test_playwright_devdep_and_config | — | — | (정적) | static |
| SC-021 | 로그인 → 대시보드 | test_when_valid_login_then_dashboard | — | — | `apps/console/e2e/auth.spec.ts` | e2e-docker(defer) |
| SC-022 | 판매자 상품 목록 접근 | test_seller_products_accessible | — | — | `apps/console/e2e/seller.spec.ts` | e2e-docker(defer) |
| SC-023 | 관리자 배너 접근 | test_admin_banners_accessible | — | — | `apps/console/e2e/admin.spec.ts` | e2e-docker(defer) |
| SC-024 | 비인증 차단 | — | — | test_when_unauth_then_login_redirect | `apps/console/e2e/guard.spec.ts` | e2e-docker(defer) |
| SC-025 | 4 시나리오 ≤2분 | test_e2e_suite_under_2min | — | — | (러너 리포트) | e2e-docker(defer, 성능) |

> **E2E 실행 절차(옵션 A)**: main session 이 backend dev·console dev(:3100) 기동 + 시드 계정 + `pnpm --filter console e2e` 절차를 사용자에게 제시 → 사용자 로컬 실행 → 결과를 Test Agent(5b)가 검증. 시드 계정(판매자·관리자)은 로컬 backend dev DB 전제(plan G).

---

## 태스크 입도 가이드

- 1 태스크 ≈ 구현 파일 1~3개 + 대응 테스트. T007(상품 페이지)·T008(배너 페이지)은 단일 페이지 수정이나 이미지 섹션 추가로 변경 폭이 있어 개별 분리.
- B 레이어(T001~T003)는 백엔드/타입 기반 — C 의 선행. T001 은 다수 후속(T003·T004·T006·T009)의 타입 전제이므로 Step 1 최우선.

## 구현 완료 기준

- [x] 모든 태스크 체크박스 완료 (B·C = 4단계 완료, D = 5a/5b)
- [x] [TypeScript] production code 0 error (`pnpm -r typecheck` — console 오류는 5a D-layer 테스트 파일 의존성 미설치에 한정, backend 0 error)
- [ ] [Backend] `pnpm --filter backend test` 전체 PASS (기존 261 + 신규 isAdmin)
- [ ] [Console] `pnpm --filter console test`(vitest) 전체 PASS (단위/통합 SC)
- [ ] [E2E] `apps/console/e2e/*.spec.ts` 작성 완료 (실행은 옵션 A — 사용자 로컬, 5b 검증)
- [ ] git status 의도치 않은 파일 없음
