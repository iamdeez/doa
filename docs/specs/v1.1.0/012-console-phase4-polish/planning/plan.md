---
작성: Planning Agent
버전: v1.0
최종 수정: 2026-06-30
상태: 확정
---

# Plan: 012-console-phase4-polish

> Branch: 012-console-phase4-polish | Date: 2026-06-30 | Spec: [spec.md](../spec/spec.md)

## 목차

- [사전 검증 (Constitution Gates)](#사전-검증-constitution-gates)
- [기술 컨텍스트](#기술-컨텍스트)
- [외부 라이브러리·기존 코드 동작 검증](#외부-라이브러리기존-코드-동작-검증)
- [핵심 설계](#핵심-설계)
  - [A. 백엔드 — GET /auth/me isAdmin (FR-001)](#a-백엔드--get-authme-isadmin-fr-001)
  - [B. ImageUpload 공용 컴포넌트 (FR-002)](#b-imageupload-공용-컴포넌트-fr-002)
  - [C. 상품 이미지 관리 (FR-003)](#c-상품-이미지-관리-fr-003)
  - [D. 배너 이미지 업로드 (FR-004)](#d-배너-이미지-업로드-fr-004)
  - [E. 역할별 라우트 가드 (FR-005·FR-006·FR-007)](#e-역할별-라우트-가드-fr-005fr-006fr-007)
  - [F. 표준 상태 컴포넌트 (FR-008·FR-009)](#f-표준-상태-컴포넌트-fr-008fr-009)
  - [G. Playwright E2E 스모크 (FR-010·FR-011)](#g-playwright-e2e-스모크-fr-010fr-011)
- [결정 기록 (ADRs)](#결정-기록-adrs)
- [인터페이스 계약](#인터페이스-계약)
- [데이터 모델](#데이터-모델)
- [테스트 전략](#테스트-전략)
- [위험 완화 설계 (PATCH-A06)](#위험-완화-설계-patch-a06)
- [기타 고려사항](#기타-고려사항)

---

## 사전 검증 (Constitution Gates)

> `.claude/docs/constitution.md` 의 P-001~P-007 조항을 기준으로 검증한다 (constitution 우선).
> spec.md NFR 이 constitution 보다 완화된 항목은 없다.

- [x] **P-001 모듈 경계 원칙**: [Pass 기준: 타 도메인 스키마 테이블 직접 참조 0건]
  - 백엔드 변경은 `auth` 모듈 단독. `AuthService.getProfile` 은 자기 책임 데이터(`users`)만 조회하고, `isAdmin` 은 `ADMIN_USER_IDS` env 비교로 도출(DB 교차 없음). 프론트 변경은 백엔드 공개 API(`GET /auth/me`, `POST /files/*`, `POST·DELETE /products/:id/images`, `POST /admin/banners`)만 호출. **PASS**
- [x] **P-002 AWS 의존 금지 원칙**: [Pass 기준: AWS 전용 SDK/서비스 신규 의존 0건]
  - 신규 의존은 `@playwright/test`(npm devDependency, 로컬 E2E 전용) 뿐. AWS SDK·서비스 추가 없음. 파일 업로드는 기존 `FileStoragePort`(presigned URL 직접 PUT) 활용 — AWS SDK 직접 사용 아님. **PASS**
- [x] **P-003 단일 DB 원칙**: [Pass 기준: 단일 PostgreSQL 외 신규 외부 저장소 0건]
  - 신규 저장소 없음. middleware 가 사용하는 쿠키는 브라우저 측 상태이며 데이터 저장소가 아니다. **PASS**
- [x] **P-004 클라우드 중립 원칙**: [Pass 기준: Fly.io 전용 API 비즈니스 로직 결합 0건]
  - Fly.io 전용 API 미사용. Next.js 표준 `middleware.ts`(Edge 표준 Web API)만 사용. **PASS**
- [x] **P-005 결제·정산 정합성 원칙**: [Pass 기준: 금전 상태 변경 시 outbox+멱등성]
  - 본 spec 은 결제·환불·정산 흐름을 변경하지 않는다. **해당 없음 → PASS**
- [x] **P-006 테스트 원칙**: [Pass 기준: SC-XXX 없는 FR-XXX 0건]
  - FR-001~FR-011 전부 대응 SC 존재(역검증 완료, 아래 [테스트 전략](#테스트-전략) 매핑). **PASS**
- [x] **P-007 스펙 범위 원칙**: [Pass 기준: spec.md 범위 외 변경 파일 0건]
  - 모든 변경이 spec FR 매핑 범위 내. `AdminGuard` 공유 헬퍼 추출(ADR-001) 은 **행위 보존 리팩토링**이며 FR-001(isAdmin 판정 일관성) 을 직접 지원하므로 범위 내. **PASS**

예외 사항: 없음.

> Gates 전체 통과 — Design Agent(3단계) 진행 가능.

---

## 기술 컨텍스트

- **언어 / 런타임**:
  - 백엔드: Node.js 20 + TypeScript, NestJS (apps/backend).
  - 프론트: Next.js 15 App Router + React 19 (apps/console), TanStack Query v5.
- **주요 의존성 (기존)**: `@doa/api-client`, `@doa/shared-types`, `@doa/ui`, `class-validator`, `@nestjs/swagger`. ConfigService(NestJS).
- **신규 의존성**: `@playwright/test`(apps/console devDependency, 로컬 E2E 전용). PyPI 아님(PATCH-A15 무관). 백엔드/console Docker 이미지에 포함되지 않음(Playwright 로컬 dev 도구).
- **테스트 프레임워크**:
  - 백엔드: Jest(`pnpm --filter backend test`) — 기존 unit/e2e 패턴.
  - 프론트 단위/통합: (현재 console 에 단위 테스트 러너 미구성) — 본 spec 의 [env:unit]/[env:integration] SC 는 Test Agent 가 러너 구성 포함하여 결정. 정적 SC([env:static])는 파일 존재·코드 패턴 grep 검증.
  - E2E: `@playwright/test`(`apps/console/playwright.config.ts`, `apps/console/e2e/`).
- **배포 환경 영향 (PROC-009)**: console 은 Vercel 자동 배포(infra.md §2), 백엔드는 Fly.io. 본 spec 은 배포 토폴로지·컨테이너 구성을 변경하지 않는다. middleware 는 Vercel Edge/Node 런타임에서 동작하며 Fly.io 전용 의존 없음. `ADMIN_USER_IDS`(백엔드 secret)·`NEXT_PUBLIC_API_URL`(console)·`CORS_ORIGIN` 은 기존 환경변수 재사용(신규 추가 없음). infra.md §8 `AdminGuard fail-closed` 제약: `ADMIN_USER_IDS` 미설정 시 전원 비관리자 → middleware 가 `/admin/*` 전체 차단(spec 사후검증 시나리오 2와 동일, 의도된 동작).

---

## 외부 라이브러리·기존 코드 동작 검증

> spec 가정이 기존 백엔드/프론트 코드 동작에 의존하므로 venv(코드) 직접 확인. (PATCH-A07: 인정되는 한계 명시 포함)

| 검증 항목 | 확인한 소스 | 실제 동작 | spec 가정과 일치? |
|---|---|---|---|
| `ADMIN_USER_IDS` 판정 로직 | `apps/backend/src/shared/auth/admin.guard.ts` L26-34 | `process.env['ADMIN_USER_IDS']` 콤마분리·trim·빈값필터 후 `includes(userId)`. 미설정/빈값 → 전원 거부(fail-closed) | 일치 (ASM-002). FR-001 은 동일 로직을 재사용 |
| `GET /auth/me` 응답 형태 | `auth.controller.ts` L57-62 + `auth.service.ts` `getProfile` L172-178 | `{ id, email, createdAt }` 반환. JwtAuthGuard 적용 | 일치 — `isAdmin` 추가 지점 명확(getProfile 반환 + AuthProfileResponse DTO) |
| files presign/confirm 계약 | `file.service.ts` L37-101, `file.controller.ts` | presign: `{id,key,uploadUrl,url}` 반환, contentType allowlist(이미지 4종) 외 400. confirm: `{size}` body, PENDING→UPLOADED, size 1..10MiB 외 400, 이미 UPLOADED → 멱등 | 일치 (ASM-001). NFR-002 클라이언트 검증 기준과 동일(`ALLOWED_CONTENT_TYPES`·`MAX_FILE_SIZE_BYTES`) |
| 상품 이미지 엔드포인트 | `product.controller.ts` L165-187, `add-image.dto.ts` | `POST /products/:id/images { url, displayOrder? }` (201), `DELETE /products/:id/images/:imageId` (204). 10개 초과 → 400 | 일치 (FR-003) |
| 상품 상세 images 포함 | `product-response.dto.ts` L94-101 (`ProductDetailResponse`) | `GET /products/:id` 응답에 `images: ProductImageResponse[]` 포함. **단, ACTIVE/OUT_OF_STOCK 만 조회 가능 — DRAFT/INACTIVE 는 404** | 일치하되 한계 존재(아래) |
| console 토큰 저장 방식 | `lib/token-store.ts`, `lib/config.ts` | accessToken/refreshToken 을 **localStorage** 에 저장(`doa.console.accessToken` 등). 쿠키 미사용 | **불일치 위험** — Next.js middleware(서버측)는 localStorage 를 읽을 수 없음 → 쿠키 미러링 설계 필요(ADR-003) |
| auth.tsx isAdmin 현재 상태 | `lib/auth.tsx` L100-113 | `isAdmin: false` 하드코딩 | FR-005 변경 지점 명확 |
| dashboard nav admin 필터 | `app/(dashboard)/layout.tsx` L52-53 | admin 섹션 항상 노출(문서화된 갭). seller 섹션만 `isSeller` 필터 | FR-007 변경 지점 명확 |
| shared-types UserProfile | `packages/shared-types/src/index.ts` L64-70 | **수기 작성** 인터페이스(`{id,email,name?,phone?,createdAt?}`). console `auth.me()` 가 이 타입 사용 | FR-005 위해 `isAdmin?: boolean` 필드 추가 필요 |

**인정되는 한계 (PATCH-A07)**:
- **L1. 상품 이미지 섹션 표시 조건**: `GET /products/:id` 가 DRAFT/INACTIVE 상품을 404 로 반환(기존 BE-GAP-003, 페이지 주석 L39 명시)하므로, 이미지 관리 섹션은 **ACTIVE/OUT_OF_STOCK 상품(detail.data 존재)에서만** 노출된다. DRAFT 상품은 기존 DraftPanel(게시 유도)로 분기. FR-003 은 "상품 상세 페이지에 이미지 섹션 추가" 를 요구하며 detail.data 분기 내 배치로 충족. → 안전망: 이미지 섹션을 detail.data 블록 내에 배치(설계 C 반영).
- **L2. middleware 쿠키의 신뢰 한계**: localStorage→쿠키 미러링 쿠키는 클라이언트 JS 가 기록하는 **비-HttpOnly** 쿠키이므로 위변조 가능하다. 따라서 middleware 의 `/admin/*` 차단은 **UX 보호 계층**일 뿐 보안 경계가 아니다. 실제 인가 강제는 **백엔드 AdminGuard(최종 방어선, NFR-004 명시)** 가 담당한다. → 안전망: AdminGuard 무변경 유지 + 기존 403 graceful 처리(ErrorState) 유지([위험 완화 설계](#위험-완화-설계-patch-a06)).
- **L3. StubFileStorage vs 실 R2 (ASM-001)**: presigned URL 직접 PUT 동작은 현재 StubFileStorage(결정적 URL) 기준. 실 R2 전환 시 URL 형식·CORS 차이로 PUT 실패 가능. 단위·통합 테스트(SC-004~006)는 fetch mock 기반이므로 실 R2 미검증. → 사후 운영 검증(spec PROC-014 시나리오 1) defer.

---

## 핵심 설계

> 작성 깊이: Design Agent 가 추가 설계 판단 없이 tasks.md 로 분해 가능한 수준.

### A. 백엔드 — GET /auth/me isAdmin (FR-001)

**변경 대상**:
- `apps/backend/src/shared/auth/admin-ids.ts` (신규) — 순수 헬퍼 `isAdminUserId(userId: string, rawEnv: string | undefined): boolean`. AdminGuard 의 파싱 로직(콤마분리·trim·빈값필터·includes, fail-closed)을 추출.
- `apps/backend/src/shared/auth/admin.guard.ts` (수정) — 추출한 `isAdminUserId` 호출로 교체(행위 보존, ADR-001).
- `apps/backend/src/modules/auth/auth.service.ts` (수정) — `getProfile` 반환 타입 `UserProfile` 에 `isAdmin: boolean` 추가. `isAdminUserId(userId, process.env['ADMIN_USER_IDS'])` 로 도출.
- `apps/backend/src/modules/auth/dto/auth-response.dto.ts` (수정) — `AuthProfileResponse` 에 `@ApiProperty() isAdmin!: boolean;` 추가.
- `packages/shared-types/src/index.ts` (수정) — 수기 `UserProfile` 에 `isAdmin?: boolean;` 추가(`GET /auth/me` 채움, `GET /users/me` 미채움이므로 optional).

**핵심 분기**: `getProfile(userId)` 내 `const isAdmin = isAdminUserId(userId, process.env['ADMIN_USER_IDS'])` → 반환 객체에 포함.

> ADMIN_USER_IDS 를 `process.env` 직접 참조: AdminGuard 와 동일 소스. ConfigService 경유도 가능하나 AdminGuard 가 이미 `process.env` 직접 사용 → 일관성 위해 동일 패턴(헬퍼가 rawEnv 를 인자로 받아 테스트 용이).

### B. ImageUpload 공용 컴포넌트 (FR-002)

**변경 대상**:
- `packages/api-client/src/index.ts` (수정) — `files` 그룹 추가:
  - `files.presign(body: { purpose, contentType }) → http.post<PresignResult>('/files/presign', body)` (PresignResult: `{id,key,uploadUrl,url}`).
  - `files.confirm(id, size) → http.post<FileAsset>('/files/' + id + '/confirm', { size })`.
  - `catalog.deleteImage(productId, imageId) → http.delete<void>('/products/' + productId + '/images/' + imageId)` (FR-003 용, 현재 미존재).
  - 신규 타입(`PresignRequest`/`PresignResult`/`ConfirmFileRequest` 등)은 `@doa/shared-types` 수기 타입에 추가.
- `apps/console/components/image-upload.tsx` (신규) — `<ImageUpload>` 컴포넌트.

**ImageUpload 인터페이스(시그니처)**:
```tsx
interface ImageUploadProps {
  purpose: FilePurpose;            // 'PRODUCT' | 'BANNER' 등 (shared-types enum)
  onUploaded: (publicUrl: string) => void;  // confirm 완료 후 public URL 콜백
  disabled?: boolean;              // FR-003 10장 초과 시 등 외부 비활성 제어
}
```

**3단계 흐름(핵심 로직)**:
1. 파일 선택(`<input type="file" accept="image/*">`) → 클라이언트 검증(NFR-002):
   - MIME ∈ `ALLOWED_CONTENT_TYPES`(`image/jpeg|png|webp|gif`) 아니면 → presign 미호출, 오류 상태 표시(SC-005).
   - `file.size > MAX_FILE_SIZE_BYTES`(10,485,760) 이면 → presign 미호출, 오류(SC-005).
   - 상수는 console 측에 동일 값 정의(백엔드 `file.constants.ts` 와 동기 — 매직넘버 금지, `apps/console/lib/upload-constants.ts` 신규 상수 모듈에 `ALLOWED_IMAGE_TYPES`·`MAX_IMAGE_BYTES` 명명 상수로).
2. `api.files.presign({ purpose, contentType: file.type })` → `{ id, uploadUrl, url }`. 실패 시 presign 단계 오류 메시지(SC-006).
3. `fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })` — **plain fetch 사용(authFetch 아님)**: presigned URL 은 스토리지 직접 엔드포인트이며 Authorization 헤더가 서명을 깨뜨릴 수 있음. 응답 비-2xx → PUT 단계 오류(SC-006).
4. `api.files.confirm(id, file.size)` → 실패 시 confirm 단계 오류(파일은 R2 에 올라갔으나 PENDING 유지, spec Q20). 성공 시 `onUploaded(url)` 호출(presign 의 `url` = public URL, Q12-1).

**상태 표현**: 업로드 중 `<LoadingState>`(F), 실패 시 단계별 메시지를 `<ErrorState>`(F)로. 비동기 — UI 블로킹 없음(Q15).

### C. 상품 이미지 관리 (FR-003)

**변경 대상**: `apps/console/app/(dashboard)/seller/products/[id]/page.tsx` (수정).

- `detail.data` 블록 내(ACTIVE/OUT_OF_STOCK, 한계 L1)에 `<ProductImageSection>` 추가. `detail.data.images`(이미 응답에 포함, `ProductDetailResponse.images`) 로 현재 목록 렌더.
- **이미지 목록**: 썸네일 그리드. 0장이면 `<EmptyState>`(F).
- **추가**: `<ImageUpload purpose="PRODUCT" disabled={images.length >= 10} onUploaded={(url) => addImage.mutate({ url, displayOrder: images.length })} />`.
  - `addImage` mutation → `api.catalog.addImage(productId, { url, displayOrder })`(기존) → onSuccess `refetchAll`(기존 패턴).
  - 10장 시 버튼 비활성(SC-010) — `disabled` prop + 안내 문구.
- **삭제**: 각 이미지 삭제 버튼 → `api.catalog.deleteImage(productId, imageId)`(신규 B) → onSuccess `refetchAll`.
- 로딩/에러는 기존 `Loading`/표준 컴포넌트로(F, FR-009).

### D. 배너 이미지 업로드 (FR-004)

**변경 대상**: `apps/console/app/(dashboard)/admin/banners/page.tsx` (수정 — `CreateBannerDialog`).

- `imageUrl` 텍스트 `<Input>`(L147) 을 `<ImageUpload purpose="BANNER" onUploaded={(url) => setForm(s => ({...s, imageUrl: url}))} />` + 업로드된 URL 미리보기/표시로 교체.
- 폼 제출 시 `body.imageUrl = form.imageUrl`(업로드된 public URL) — 기존 createBanner 흐름 유지(SC-012).
- 업로드 전 제출 방지: 기존 `disabled={... || !form.imageUrl}`(L164) 가 이미 imageUrl 빈값 차단 → 업로드 완료 후에만 생성 가능.
- 다이얼로그 내 업로드 실패는 `<ErrorState>`(F)로 표시(FR-009).

> `FilePurpose` enum 에 `BANNER` 존재 여부 확인 필요 — Design Agent 가 `@prisma/client` `FilePurpose` enum 을 확인하여 적합 purpose 선택(없으면 기존 purpose 중 적합값 또는 enum 확장은 범위 외이므로 기존값 사용). 본 plan 은 `purpose` 가 presign allowlist(contentType)와 무관하게 키 prefix 용도임을 전제(file.service L48).

### E. 역할별 라우트 가드 (FR-005·FR-006·FR-007)

**E-1. auth.tsx isAdmin (FR-005)** — `apps/console/lib/auth.tsx` (수정):
- `AuthState.isAdmin` 을 `profile?.isAdmin ?? false` 로 도출(L107 `isAdmin: false` 교체). `UserProfile.isAdmin`(A 에서 추가) 사용.
- 주석(L24-29) 의 "추후 isAdmin 노출 시 대체" 갭 해소 반영.

**E-2. 쿠키 미러링 (FR-006 전제, ADR-003)** — `apps/console/lib/auth.tsx` (수정):
- `hydrate()` 의 `me` 수신 직후 비-HttpOnly 쿠키 2종 기록(`document.cookie`):
  - `doa_console_auth=1; Path=/; SameSite=Lax`(인증 표식 — 존재=인증됨).
  - `doa_console_admin=<true|false>; Path=/; SameSite=Lax`(`me.isAdmin`).
- `logout()` 에서 두 쿠키 만료(`Max-Age=0`)로 제거.
- 쿠키 키는 `lib/config.ts` 의 상수로 명명(`COOKIE_KEYS.auth`/`COOKIE_KEYS.admin` — 매직스트링 금지).
- 미들웨어와 동기화: `login()` 이 `await hydrate()` 하므로 login 해소 시점에 쿠키 기록 완료(타이밍 보장).

**E-3. middleware.ts (FR-006)** — `apps/console/middleware.ts` (신규):
- `config.matcher` 로 보호 경로 패턴 지정: `/dashboard/*`, `/account/*`, `/seller/*`, `/admin/*`(로그인·정적 자원 제외).
- 로직:
  - `auth` 쿠키 부재 + 보호 경로 → `NextResponse.redirect('/login')`(SC-015, NFR-004).
  - `/admin/*` 경로 + (`auth` 쿠키 부재 OR `admin` 쿠키 !== 'true') → `/login` 리다이렉트(SC-016). (403 대신 리다이렉트 채택 — SPA 라우팅 일관성, spec SC-016 은 "403 또는 /login 리다이렉트" 허용)
- **보안 경계 아님 명시**(L2): middleware 는 UX 계층. 실제 인가는 백엔드 AdminGuard.

**E-4. nav admin 필터 (FR-007)** — `apps/console/app/(dashboard)/layout.tsx` (수정):
- `useAuth()` 에서 `isAdmin` 추가 구조분해.
- `visible` 필터에 admin 조건 추가:
  `NAV.filter((n) => (n.section !== 'seller' || isSeller) && (n.section !== 'admin' || isAdmin))`.
- L52 주석("admin 섹션 항상 노출") 갱신.

### F. 표준 상태 컴포넌트 (FR-008·FR-009)

**변경 대상**: `apps/console/components/states.tsx` (신규) — `<ErrorState>`, `<LoadingState>`, `<EmptyState>` export.

- **네이밍 주의**: `@doa/ui` 는 이미 `Loading`·`ErrorText`·`EmptyState` 를 export(banner 페이지 L5-26 사용 중). console 표준 컴포넌트는 **별도 이름**(`LoadingState`/`ErrorState`/`EmptyState`)으로 `apps/console/components/` 에 둠(SC-018 위치 요구). 내부적으로 `@doa/ui` 프리미티브를 래핑하여 일관 스타일·메시지 규약 제공 가능.
  - `apps/console/components/` 의 `EmptyState` 와 `@doa/ui` 의 `EmptyState` 동명 충돌 주의 — import 경로로 구분(`@/components/states` vs `@doa/ui`). banner 페이지는 적용 시 `@/components/states` 로 교체.
- props(시그니처 권장):
  - `<LoadingState label?: string />`
  - `<ErrorState error: unknown; onRetry?: () => void />`(ApiError 메시지 추출 + 403 분기 안내).
  - `<EmptyState title: string; message?: string; action?: ReactNode />`.
- **적용(FR-009)**: 본 spec 변경 페이지만 — 상품 상세 이미지 섹션(C), 배너 생성 다이얼로그(D). 로딩→`<LoadingState>`, 에러→`<ErrorState>`, 빈상태(이미지 0장/배너 업로드 전)→`<EmptyState>`.
- 미변경 페이지 소급 없음(QA-4 C 채택).

### G. Playwright E2E 스모크 (FR-010·FR-011)

**변경 대상**:
- `apps/console/package.json` (수정) — `@playwright/test` devDependency + `"e2e": "playwright test"` script.
- `apps/console/playwright.config.ts` (신규) — `baseURL: 'http://localhost:3100'`(next dev 포트), `testDir: './e2e'`, `timeout`·`expect timeout` 합산이 NFR-005(2분) 내. `webServer` 로 console dev 자동 기동(선택) — 단 백엔드 dev 는 외부 전제(ASM-005).
- `apps/console/e2e/*.spec.ts` (신규) — 4 시나리오(+측정):
  - `auth.spec.ts`: 유효 계정 `/login` → 대시보드 리다이렉트(SC-021).
  - `seller.spec.ts`: 판매자 계정 → `/seller/products` 접근·요소 확인(SC-022).
  - `admin.spec.ts`: 관리자 계정 → `/admin/banners` 접근(SC-023).
  - `guard.spec.ts`: 비인증 → 보호 경로 → `/login` 리다이렉트(SC-015·SC-024). 비관리자 → `/admin/*` 차단(SC-016).
  - SC-025: 전체 실행 시간 2분 이내(러너 리포트로 측정).
- **테스트 계정 전제**: 판매자·관리자 시드 계정 필요(로컬 backend dev DB). Design/Test Agent 가 시드 절차(또는 기존 시드) 확인.

**E2E 실행 환경 / defer 결정**: 아래 [테스트 전략](#테스트-전략) "E2E defer 옵션" 참조.

---

## 결정 기록 (ADRs)

| ADR-ID | 결정 항목 | 채택안 | 대안 (검토했으나 채택 안 함) | 근거 (spec FR/NFR 참조) | 영향 범위 |
|---|---|---|---|---|---|
| ADR-001 | isAdmin 판정 위치·방식 | `AuthService.getProfile` 에서 `ADMIN_USER_IDS` env 비교. 파싱 로직을 `shared/auth/admin-ids.ts` 순수 헬퍼로 추출하여 AdminGuard 와 공유 | (a) JWT 클레임에 isAdmin 삽입 — env 변경 시 토큰 stale·재발급 필요 / (b) AuthService 내 파싱 인라인 중복 — AdminGuard 와 drift 위험 | FR-001, ASM-002 (AdminGuard 동일 소스 재사용·일관성) | `auth.service.ts`·`auth-response.dto.ts`·`admin.guard.ts`·신규 `admin-ids.ts`·`shared-types` |
| ADR-002 | 파일 업로드 3단계 오케스트레이션 위치 | `<ImageUpload>` 컴포넌트 내부 + api-client `files` 그룹. PUT 은 plain `fetch`(authFetch 미적용) | (a) 호출 페이지마다 인라인 구현 — 중복 / (b) PUT 도 authFetch 경유 — presigned URL 서명 훼손 위험 | FR-002, NFR-002, NFR-003 (재사용·silent fail 금지) | `components/image-upload.tsx`·`api-client`·`shared-types`·`upload-constants.ts` |
| ADR-003 | 라우트 가드 인증 상태 전달 방식 | localStorage 토큰을 **비-HttpOnly 쿠키 2종**(`auth`/`admin`)으로 미러링(auth.tsx hydrate 시 기록), middleware 가 쿠키로 coarse gating | (a) 토큰을 쿠키로 완전 이전 — api-client 대규모 변경·SSR 재설계 / (b) middleware 가 매 요청 `/auth/me` fetch — 지연·Edge 복잡 / (c) NEXT_PUBLIC ADMIN env 로 JWT 디코드 비교 — admin 목록 중복·민감정보 노출 | FR-006, NFR-004 (middleware=UX 계층, AdminGuard=최종 방어선) | `lib/auth.tsx`·`lib/config.ts`·신규 `middleware.ts` |
| ADR-004 | 표준 상태 컴포넌트 위치·네이밍 | `apps/console/components/states.tsx` 에 `LoadingState`/`ErrorState`/`EmptyState` 신규(@doa/ui 프리미티브 래핑) | @doa/ui 기존 `Loading`/`ErrorText`/`EmptyState` 만 재사용 — SC-018 의 `apps/console/components/` 위치 요구 미충족·console 일관 규약 부재 | FR-008, SC-018 (위치·네이밍 명시) | 신규 `components/states.tsx`·변경 페이지 import |
| ADR-005 | E2E 러너·디렉토리·실행 전제 | `@playwright/test`(console devDep) + `playwright.config.ts`(baseURL :3100) + `e2e/` 디렉토리. 로컬 `next dev`+backend dev 전제(ASM-005) | (a) Cypress — 추가 학습·중량 / (b) CI 통합 — 범위 외(spec) / (c) Docker compose E2E — 인프라 작업 범위 외(ASM-005) | FR-010, FR-011, NFR-005 (로컬 전용·2분) | `package.json`·신규 `playwright.config.ts`·`e2e/*.spec.ts` |
| ADR-006 | `/admin/*` 비관리자 차단 응답 | `/login` 리다이렉트 | 403 응답 페이지 | SC-016 ("403 또는 /login 리다이렉트" 허용) — SPA 라우팅 일관성·기존 onAuthExpired 흐름과 정합 | `middleware.ts` |

> 본 표는 Design Agent 의 research.md "기술 선택 조사" 절과 cross-reference. ADR 미작성 결정 발견 시 status: BLOCKED 로 Planning 복귀.

---

## 인터페이스 계약

**하위 호환성**:
- `GET /auth/me` 에 `isAdmin` **추가**(필드 추가는 비파괴적). 기존 console `auth.me()` 소비자는 추가 필드 무시 가능. shared-types `UserProfile.isAdmin?` optional(다른 `me` 엔드포인트 미채움 호환).
- api-client `files` 그룹·`catalog.deleteImage` **신규 추가**(기존 메서드 시그니처 불변).
- `<ImageUpload>`/표준 컴포넌트는 신규 — 기존 컴포넌트 영향 없음. banner 페이지의 `@doa/ui` import 는 표준 컴포넌트 적용 시 `@/components/states` 로 부분 교체(동명 `EmptyState` 충돌은 import 경로로 구분).

**방어 코드**:
- 업로드 3단계 각 단계 try/catch → 단계별 오류 메시지(NFR-003 silent fail 금지). confirm 실패 시 "파일 업로드는 됐으나 확정 실패 — 재시도" 안내.
- 401 → 기존 `onAuthExpired`(`/login` 리다이렉트) 유지. 403(admin 비인가) → `<ErrorState>` 403 분기.

### 권한 부여·상태 전이 엔드포인트 인가 3축 (PATCH-001 / PROC-003)

> Security 단계 비활성(아래 selection-phases) — 본 표가 최소 방어선이다.

| 엔드포인트 | (a) 호출자 신원(인증) | (b) 대상 자원 소유권 | (c) 역할(admin 등) | 미검증 축 위험·후속 |
|---|---|---|---|---|
| `GET /auth/me` (FR-001) | JWT (JwtAuthGuard) | 본인(userId from token) | — (isAdmin 은 응답 데이터일 뿐, 인가 아님) | 없음 — 자기 프로필 조회. isAdmin 누출 위험: 본인의 admin 여부만 노출(타인 정보 아님), 허용 |
| `POST /products/:id/images` (FR-003) | JWT | productService 소유권 검증(기존 `addImage` 내) | — | 소유권은 기존 service 가 강제(검증 완료). 본 spec 무변경 |
| `DELETE /products/:id/images/:imageId` (FR-003) | JWT | productService 소유권 검증(기존 `deleteImage`) | — | 동일 — 기존 강제 |
| `POST /files/presign`·`/files/:id/confirm` (FR-002) | JWT (FileController `@UseGuards`) | confirm/getById 소유자 검증(file.service, 011) | — | 기존 강제(011 SEC-FIND-006-01/02) |
| `POST /admin/banners` (FR-004) | JWT | — (플랫폼 자원) | **AdminGuard**(ADMIN_USER_IDS) | 기존 강제. middleware 는 추가 UX 계층(NFR-004) |
| console `/admin/*` 라우트 (FR-006) | 쿠키 `auth`(미러) | — | 쿠키 `admin`(미러, **클라이언트 신뢰**) | **(c) 축이 클라이언트 신뢰 쿠키** → 위변조 가능. 실제 강제는 백엔드 AdminGuard. middleware 는 UX 계층(L2·NFR-004). 안전망: AdminGuard 무변경 |

---

## 데이터 모델

**DB 스키마 변경 없음**. 

- `isAdmin` 은 **저장하지 않고 도출**(`ADMIN_USER_IDS` env 비교) — 테이블/컬럼 추가 없음.
- `ProductImage`(`products.product_images`)·`Banner`(`admin.banners`)·`FileAsset`(`files.file_assets`)·`UserProfile`(`users.users`) 전부 기존. 신규 마이그레이션 불필요 → Database Design Agent 비활성(selection-phases).

---

## 테스트 전략

> 테스트 수준: 단위 / 통합 / E2E. SC-XXX 의 [env:*] 태그 기준.
> 시나리오 유형(Happy/Edge/Error)은 FR 그룹 단위로 포괄 — 존재성 검증(static) SC 는 Happy(존재 확인)만 본질적으로 해당.

| SC | 수준 | 유형 | 시나리오 요약 | 입력 | 기대 결과 |
|---|---|---|---|---|---|
| SC-001 | 단위 | Happy | `getProfile` 응답에 isAdmin 포함 | userId | 반환 객체에 `isAdmin: boolean` |
| SC-002 | 단위 | Happy/Error/Edge | env 포함→true, 미포함→false, env 미설정→false | userId + ADMIN_USER_IDS 변형 | admin=true / 비admin=false / 미설정=false |
| SC-003 | 단위 | (회귀) | 기존 백엔드 테스트 전량 PASS + 신규 isAdmin 테스트 | 전체 스위트 | 기존 전량 PASS, 신규 추가 |
| SC-004 | 단위 | Happy | ImageUpload 3단계 호출 순서 | 유효 이미지 파일(mock fetch) | presign→PUT(uploadUrl)→confirm 순서 호출, onUploaded(url) |
| SC-005 | 단위 | Edge/Error | MIME 불허/10MiB 초과 | webp 외 타입 / 11MiB 파일 | presign 미호출 + 오류 메시지 |
| SC-006 | 단위 | Error | presign/PUT/confirm 각 단계 실패 | 각 단계 mock reject | 해당 단계 오류 메시지(silent fail 없음) |
| SC-007 | 통합 | Happy | 상품 상세 이미지 섹션·목록 렌더 | images 포함 detail | 이미지 섹션 + 썸네일 목록 |
| SC-008 | 통합 | Happy | 업로드 완료 후 POST images | onUploaded(url) | `POST /products/:id/images {url,displayOrder}` 호출 |
| SC-009 | 통합 | Happy | 삭제 버튼 → DELETE | 이미지 삭제 클릭 | `DELETE /products/:id/images/:imageId` 호출 |
| SC-010 | 단위 | Edge | 10장 시 추가 비활성 | images.length===10 | 업로드 버튼 disabled |
| SC-011 | 정적 | Happy | 배너 폼 imageUrl=ImageUpload | 소스 grep | `<ImageUpload>` 사용(텍스트 input 제거) |
| SC-012 | 통합 | Happy | 배너 생성 시 업로드 URL 전송 | 업로드 후 제출 | createBanner body.imageUrl = public URL |
| SC-013 | 정적 | Happy | auth.tsx isAdmin=profile 값 | 소스 grep | `false` 하드코딩 제거, `profile?.isAdmin` 사용 |
| SC-014 | 정적 | Happy | middleware.ts 존재 + 보호 패턴 | 파일 존재·matcher | `apps/console/middleware.ts` + config.matcher |
| SC-015 | E2E | Error | 비인증 보호경로 → /login | 쿠키 없이 `/seller/products` | `/login` 리다이렉트 |
| SC-016 | E2E | Error | 비관리자 /admin/* 차단 | admin 쿠키 false + `/admin/banners` | `/login`(또는 403) |
| SC-017 | 단위 | Happy/Edge | nav admin 항목 숨김 | isAdmin=false | admin 섹션 항목 미표시 |
| SC-018 | 정적 | Happy | 3개 컴포넌트 파일 존재 | 파일 존재 | `components/states.tsx`(ErrorState/LoadingState/EmptyState) |
| SC-019 | 통합 | Happy | 변경 페이지 표준 컴포넌트 적용 | 상품/배너 페이지 렌더 | 로딩·에러·빈상태가 표준 컴포넌트 |
| SC-020 | 정적 | Happy | playwright devDep + config | package.json·config | `@playwright/test` devDep + `playwright.config.ts` |
| SC-021 | E2E | Happy | 로그인 → 대시보드 | 유효 계정 | 대시보드 리다이렉트 |
| SC-022 | E2E | Happy | 판매자 상품 목록 접근 | seller 계정 | `/seller/products` 요소 확인 |
| SC-023 | E2E | Happy | 관리자 배너 접근 | admin 계정 | `/admin/banners` 접근 |
| SC-024 | E2E | Error | 비인증 차단 | 쿠키 없음 | `/login` 리다이렉트 |
| SC-025 | E2E | (성능) | 4 시나리오 ≤2분 | 전체 e2e | 실행시간 < 120s |

**FR 그룹별 Happy/Edge/Error 포괄 확인**:
- FR-001(SC-001~003): Happy(포함)·Error/Edge(비admin·env미설정) 커버.
- FR-002(SC-004~006): Happy(3단계)·Edge(검증 차단)·Error(단계 실패) 커버.
- FR-003(SC-007~010): Happy(목록·추가·삭제)·Edge(10장 비활성) 커버. Error 는 업로드 컴포넌트(FR-002)가 흡수.
- FR-006(SC-014~016): Happy(존재)·Error(차단 2종) 커버.
- FR-007(SC-017): Happy(표시)·Edge(숨김) 커버.

### smoke_tests (선택)

- 필요 여부: **N**.
- 근거: 변경이 신규 컴포넌트·신규 라우트 가드·기존 페이지 2곳에 국한. 기존 SC 범위 밖 중요 경로 회귀 가능성 낮음(백엔드는 isAdmin 필드 추가만 — 기존 261 회귀는 SC-003 이 직접 커버). E2E 스모크(SC-021~024)가 핵심 경로 회귀를 별도 커버.

### E2E defer 옵션 (PATCH-A08 / PROC-010)

[env:e2e-docker] 태그 SC(SC-015·016·021~025)는 실행에 **running backend dev + console dev + 시드 계정**이 필요하다. spec 범위 외(CI 자동화 제외, 로컬 전용·ASM-005)이므로 파이프라인 내 실행을 defer한다.

**옵션 결정**: **옵션 A 권장** — main session 이 실행 절차(backend dev·console dev 기동 + `pnpm --filter console e2e`) 제시 → 사용자 로컬 실행 → 결과 전달 → Test Agent 검증. 사용자가 직접 환경을 보유하면 옵션 B 도 동등. (Spec Agent 가 A/B/C 사용자 선택을 명시 수집하지 않았으므로, main session 이 AWAITING_USER 로 확정 위임.)

**PROC-010 운영 환경 의존성 자가 점검**:
1. **운영 환경 의존성**: Y — E2E 는 실제 라우팅·미들웨어·쿠키 동기화·백엔드 인증에 의존. mock 으로 대체 불가.
2. **mock 시뮬레이션 불가 시나리오**: 미들웨어 서버측 리다이렉트(SC-015/016), 쿠키 미러링 타이밍(login 후 가드 동작), 실제 로그인 토큰 흐름(SC-021).
3. **권장 옵션 재검토**: 1·2 가 Y → 옵션 A/B 권장(옵션 C 미채택). 정적/단위 SC(SC-001~014,017~020)는 파이프라인 내 Test Agent 가 검증. 운영 보완: spec PROC-014 사후 검증 시나리오(관리자 로그인→배너 업로드→상품 이미지) 수동 1회 권고.

### 사후 운영 검증 피드백 사이클 (PROC-014)

spec.md "사후 운영 검증 피드백 사이클" 절에 명시됨(2 시나리오: StubFileStorage→실 R2 PUT, ADMIN_USER_IDS 미설정 시 /admin/* 전체 차단). 결함 발견 시 다음 spec 입력 → main session `spec 수정` → 1단계 재진입. 본 plan 한계 L1~L3 와 연계.

---

## 위험 완화 설계 (PATCH-A06)

> assumptions.md ASM 중 운영 검증 defer 항목의 부정 검증 대비 안전망.

| ASM/한계 | 부정 검증 시 영향 | 안전망 |
|---|---|---|
| ASM-001 / L3 (StubFileStorage→실 R2 PUT 실패) | 업로드 PUT 단계 실패 → 이미지 미등록 | NFR-003 단계별 오류 메시지(SC-006)로 silent fail 차단 + 재시도 가능. 운영 모니터링: 배포 직후 수동 업로드 1회(PROC-014) |
| L2 (admin 쿠키 위변조) | 비관리자가 쿠키 조작으로 `/admin/*` UI 진입 | 백엔드 AdminGuard(최종 방어선, 무변경) → admin API 403 → `<ErrorState>` 403 분기. middleware 는 UX 계층임을 plan·코드 주석에 명시 |
| L1 (DRAFT 상품 이미지 섹션 부재) | DRAFT 상품에서 이미지 업로드 불가 | 의도된 동작(게시 후 관리). DraftPanel 이 게시 유도. FR-003 은 detail.data 분기로 충족 |
| ASM-005 (E2E 로컬 환경 전제) | CI/Docker 미구성 시 자동 회귀 미동작 | 옵션 A/B 로 로컬 실행 + 정적 SC-020(config 존재) 파이프라인 검증. CI 통합은 후속 spec |

---

## 기타 고려사항

- **상수 동기화**: console 측 업로드 검증 상수(`ALLOWED_IMAGE_TYPES`·`MAX_IMAGE_BYTES`)는 백엔드 `file.constants.ts`(`ALLOWED_CONTENT_TYPES`·`MAX_FILE_SIZE_BYTES`) 와 **동일 값**이어야 한다(NFR-002). 매직넘버 금지 — 명명 상수 모듈로 정의. 두 값 불일치 시 클라이언트 통과→백엔드 거부의 UX 불일치 발생.
- **쿠키 동시성/생명주기(ADR-003)**: 쿠키는 hydrate(login + 페이지 로드) 시 기록, logout 시 제거. 단일 탭 가정(내부 운영 대시보드). 토큰 만료 시 쿠키는 잔존할 수 있으나 api 401 → onAuthExpired 가 `/login` 강제 → 실질 게이트 유지. middleware 는 coarse 게이트이므로 정확한 만료 동기화는 비요구.
- **FilePurpose enum 확인**: D(배너)·C(상품) presign 의 `purpose` 값은 Design Agent 가 `@prisma/client` `FilePurpose` enum 실값을 확인하여 선택. enum 확장이 필요하면(BANNER 부재 등) 범위 영향 — 본 plan 은 기존 enum 값 사용 전제(키 prefix 용도).
- **console 단위/통합 테스트 러너**: 현재 console 에 단위 테스트 인프라 미구성. [env:unit]/[env:integration] SC(SC-004~010,012,017,019) 구현을 위해 Test Agent 가 러너(예: vitest + @testing-library/react) 구성을 동반해야 할 수 있음. 이는 FR-002·003 검증의 필수 전제이며 본 spec 테스트 범위 내. Design Agent 가 tasks.md D 레이어에서 러너 구성 task 포함 여부 판단.
- **엣지**: 동일 파일 재선택(input change 미발화) — input value reset 처리. 업로드 중 다이얼로그 닫힘 — abort 또는 무시(내부 도구 수준, 단순 처리).
