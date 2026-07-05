---
작성: Design Agent
버전: v1.0
최종 수정: 2026-06-30 17:44
상태: 확정
---

# Research: 012-console-phase4-polish

## 목차

- [기존 코드베이스 분석](#기존-코드베이스-분석)
  - [클래스·모듈 계층 구조](#클래스모듈-계층-구조)
  - [영향 범위 분석 (변경 파일 전수)](#영향-범위-분석-변경-파일-전수)
  - [공유 상태·동시성 분석](#공유-상태동시성-분석)
- [§F production 시그니처 변경 — 호출 측 테스트 식별 (PROC-001)](#f-production-시그니처-변경--호출-측-테스트-식별-proc-001)
- [외부 라이브러리·기존 코드 실제 동작 확인](#외부-라이브러리기존-코드-실제-동작-확인)
- [인정되는 한계 및 안전망 (PATCH-A07)](#인정되는-한계-및-안전망-patch-a07)
- [배포 환경 영향 추정 (PATCH-A10)](#배포-환경-영향-추정-patch-a10)
- [context.md 부정합 사전 점검 (PATCH-A11)](#contextmd-부정합-사전-점검-patch-a11)
- [기술 선택 조사](#기술-선택-조사)
- [엣지 케이스 및 한계](#엣지-케이스-및-한계)

> plan.md 의 ADR-001~006 및 "외부 라이브러리·기존 코드 동작 검증" 표와 cross-reference. 전체 구조는 `.claude/docs/context.md §2` 참조(중복 기술 생략).

---

## 기존 코드베이스 분석

### 클래스·모듈 계층 구조

**백엔드 (변경 대상 한정)**:

- `AuthService`(`apps/backend/src/modules/auth/auth.service.ts`) — `@Injectable` concrete. `getProfile(userId): Promise<UserProfile>` (L172). 모듈 로컬 `UserProfile` 인터페이스(L27 `{id, email, createdAt}`) 보유.
- `AdminGuard`(`apps/backend/src/shared/auth/admin.guard.ts`) — `implements CanActivate`. 파싱 로직 인라인(L26-34). 7개 컨트롤러가 `@UseGuards(AdminGuard)` 로 소비(seller·settlement·admin·coupon·stats·banner). **본 spec 은 AdminGuard 의 공개 동작(canActivate)을 변경하지 않고 내부 파싱만 헬퍼로 추출** → 소비 컨트롤러 영향 0.
- `user.service.ts` 의 `getProfile`(L59)·모듈 로컬 `UserProfile` 은 **별개 인터페이스**(다른 모듈). 본 spec 미변경.

**프론트 (console / packages)**:

- `AuthProvider`/`useAuth`(`apps/console/lib/auth.tsx`) — React Context. `isAdmin: false` 하드코딩(L107). `hydrate()` 가 `api.auth.me()` → `setProfile`(L65-66).
- `browserTokenStore`(`apps/console/lib/token-store.ts`) — localStorage 기반 `TokenStore`. 쿠키 미사용.
- `DashboardLayout`(`apps/console/app/(dashboard)/layout.tsx`) — NAV 필터 `n.section !== 'seller' || isSeller`(L53). admin 섹션 무조건 노출(L52 주석).
- api-client(`packages/api-client/src/index.ts`) — 도메인별 그룹(`auth`·`catalog`·`admin`·...). `catalog.addImage`(L140) 존재, `catalog.deleteImage`·`files` 그룹 **미존재**. HttpClient(`http.ts`)는 `get`·`post`·`delete` 제공(`put` 없음 — presigned PUT 은 plain `fetch`).

**신규 클래스/컴포넌트 (상속 트리 무관 — 함수형 React 컴포넌트 + 순수 함수)**:

- `isAdminUserId(userId, rawEnv): boolean` (신규 순수 함수, `admin-ids.ts`).
- `<ImageUpload>`·`<LoadingState>`·`<ErrorState>`·`<EmptyState>` (신규 함수형 컴포넌트). `@doa/ui` 프리미티브(`Loading`·`ErrorText`·`EmptyState`) 래핑.
- `middleware.ts` (신규 Next.js Edge 미들웨어 — default-export 함수 + `config.matcher`).

### 영향 범위 분석 (변경 파일 전수)

| 파일 | 변경 유형 | 영향 내용 | FR |
|---|---|---|---|
| `apps/backend/src/shared/auth/admin-ids.ts` | 신규 | 순수 헬퍼 `isAdminUserId(userId, rawEnv)` (AdminGuard 파싱 추출) | FR-001(ADR-001) |
| `apps/backend/src/shared/auth/admin.guard.ts` | 수정 | 인라인 파싱 → `isAdminUserId` 위임(행위 보존) | FR-001 |
| `apps/backend/src/modules/auth/auth.service.ts` | 수정 | `UserProfile` 에 `isAdmin: boolean` 추가, `getProfile` 도출 | FR-001 |
| `apps/backend/src/modules/auth/dto/auth-response.dto.ts` | 수정 | `AuthProfileResponse` 에 `@ApiProperty() isAdmin!: boolean` | FR-001 |
| `packages/shared-types/src/index.ts` | 수정 | `UserProfile.isAdmin?` + `FilePurpose` union + presign/confirm/FileAsset 타입 | FR-001·FR-002 |
| `packages/api-client/src/index.ts` | 수정 | `files`(presign/confirm) 그룹 + `catalog.deleteImage` 신규 | FR-002·FR-003 |
| `apps/console/lib/upload-constants.ts` | 신규 | `ALLOWED_IMAGE_TYPES`·`MAX_IMAGE_BYTES` 명명 상수(BE 동기) | FR-002(NFR-002) |
| `apps/console/components/states.tsx` | 신규 | `LoadingState`·`ErrorState`·`EmptyState` | FR-008 |
| `apps/console/components/image-upload.tsx` | 신규 | `<ImageUpload>` 3단계 업로드 | FR-002 |
| `apps/console/app/(dashboard)/seller/products/[id]/page.tsx` | 수정 | 이미지 관리 섹션(detail.data 블록 내) + 표준 컴포넌트 | FR-003·FR-009 |
| `apps/console/app/(dashboard)/admin/banners/page.tsx` | 수정 | CreateBannerDialog imageUrl Input → `<ImageUpload>` + 표준 컴포넌트 | FR-004·FR-009 |
| `apps/console/lib/auth.tsx` | 수정 | `isAdmin=profile?.isAdmin ?? false` + 쿠키 미러링(hydrate/logout) | FR-005·FR-006 |
| `apps/console/lib/config.ts` | 수정 | `COOKIE_KEYS`(auth·admin) 상수 추가 | FR-006 |
| `apps/console/middleware.ts` | 신규 | 보호 경로 가드 + `/admin/*` 비관리자 차단 | FR-006 |
| `apps/console/app/(dashboard)/layout.tsx` | 수정 | NAV admin 필터 `(n.section !== 'admin' || isAdmin)` | FR-007 |
| `apps/console/package.json` | 수정 | `@playwright/test` + vitest·@testing-library devDep + scripts (테스트 인프라 — D 레이어 소유) | FR-010 |
| `apps/console/playwright.config.ts` | 신규 | baseURL :3100, testDir ./e2e | FR-010 |
| `apps/console/vitest.config.ts` (+ setup) | 신규 | jsdom + RTL 러너 | FR-002·003 테스트 전제 |
| `apps/console/e2e/*.spec.ts` | 신규 | 4 스모크 시나리오(실행 defer) | FR-011 |

> **배제 항목**: `apps/backend/src/modules/auth/auth.controller.ts` — `me` 핸들러는 `getProfile` 결과를 그대로 반환하고 `@ApiOkResponse({ type: AuthProfileResponse })` 가 이미 DTO 를 참조. DTO 에 isAdmin 추가 시 swagger 자동 반영, 핸들러 코드 변경 불요 → **수정 대상 아님**(컴파일 영향 없음). `user.service.ts`/`user.controller.ts` 의 `getProfile` 은 별개 모듈·별개 인터페이스로 미변경.

### 공유 상태·동시성 분석

- **백엔드 isAdmin 도출**: `process.env['ADMIN_USER_IDS']` 읽기 전용. 쓰기 없음 → race 없음. AdminGuard 와 동일 소스(공유 헬퍼)이나 둘 다 읽기 전용·stateless 순수 함수 → 동시성 안전.
- **console 쿠키 미러링(ADR-003)**: `document.cookie` 쓰기는 `hydrate()`(me 수신 직후)·`logout()` 두 지점. 단일 탭 가정(내부 운영 대시보드). 쿠키 2종(`auth`·`admin`)을 **동일 가드 조건 하에서 함께 기록**(§E 통합 결정 — me 존재 여부 단일 분기). Check-Then-Act 없음(단순 set). middleware 는 쿠키 read-only.
- **ImageUpload 3단계**: 컴포넌트 로컬 상태(업로드 중 플래그). 단일 사용자 인터랙션·비동기 순차(presign→PUT→confirm). 공유 가변 상태 없음. 동일 파일 재선택 시 `<input>` value reset 처리(엣지).

---

## §F production 시그니처 변경 — 호출 측 테스트 식별 (PROC-001)

> FR-001 은 production 메서드 반환 타입 변경(`getProfile`)과 행위 보존 리팩토링(AdminGuard 파싱 추출)을 포함. 호출 측 테스트 영향을 전수 식별한다.

### 변경되는 production 심볼

| 심볼 | 시그니처 전 | 시그니처 후 | 변경 분류 |
|---|---|---|---|
| `AuthService.getProfile(userId)` | `Promise<{id, email, createdAt}>` | `Promise<{id, email, createdAt, isAdmin}>` | **반환 타입 필드 추가(additive)** — 인자 불변, sync 유지 |
| `AdminGuard.canActivate(ctx)` | `boolean` (파싱 인라인) | `boolean` (파싱 → `isAdminUserId` 위임) | **행위 보존(시그니처 불변)** |
| `isAdminUserId(userId, rawEnv)` | (없음) | `boolean` (신규 순수 함수) | 신규 |

### 각 심볼 직접 호출 측 + 테스트 (grep 결과)

**`getProfile` 호출 측** (`grep -rn "getProfile" apps/backend/src`):
- `auth.controller.ts:61` — `this.authService.getProfile(user.userId)` (`me` 핸들러). 결과를 그대로 반환. **마이그레이션 불요**(additive 필드는 호출 측 무영향).
- `user.controller.ts:39`·`user.service.ts:59` — **user 모듈의 별개 `getProfile`**(별개 `UserProfile`). 본 spec 미변경 → 무관.

**`getProfile`/`/auth/me` 검증 테스트**:
- `apps/backend/test/auth.e2e-spec.ts` L202-221 `SC-019: GET /auth/me → 200 {id, email, createdAt}` — `toHaveProperty('id'|'email'|'createdAt')` 단언. **`toHaveProperty` 는 추가 필드에 무관(additive-safe) → PASS 유지**. (representation: response.body 객체 속성 직접 접근 — isAdmin 추가는 기존 단언을 깨지 않음.)
- `apps/backend/src/modules/auth/auth.service.spec.ts` — `getProfile` 직접 단언 테스트 **부재**(login/register/refresh 만 테스트, L89-243). → SC-001·SC-002 신규 단위 테스트를 본 파일에 추가.
- `apps/backend/src/modules/user/user.service.spec.ts:104`·`user.controller.spec.ts` — **user 모듈** getProfile mock. 본 spec 무관(별개 모듈) → 무영향.

**`AdminGuard` 검증 테스트**:
- `apps/backend/src/shared/auth/admin.guard.spec.ts` — `guard.canActivate(...)` 호출, `ADMIN_USER_IDS` 변형(포함→통과/미포함→403/빈값→fail-closed) 단언. **canActivate 동작·시그니처 불변 → PASS 유지**. (행위 보존 리팩토링이므로 representation·patch target 변화 없음.)

**`AdminGuard` 소비 컨트롤러** (seller·settlement·admin·coupon·stats·banner): `@UseGuards(AdminGuard)` 데코레이터만 — 클래스 export 불변 → 무영향.

### 호출 측 마이그레이션 필요 여부 판정

- `getProfile` 반환 타입 변경 = **additive 필드 추가**(sync→async 아님, 인자 추가 아님, 기존 필드 제거·타입 변경 아님). 호출 측 unpacking·assert 정합화 **불요**. 정적 AST 검사 테스트(`ast.FunctionDef` 매칭류) 해당 없음.
- `AdminGuard` = 행위 보존 → 마이그레이션 불요.
- **결론: 호출 측 테스트 마이그레이션 0건. baseline 회귀 위험 없음.** 본 spec 범위는 FR-001(SC-001~003) 신규 단위 테스트 추가 + 기존 261 PASS 유지(SC-003). SCOPE_VIOLATION 없음 → BLOCKED 불요.

### PASS 유지 예측 representation/바인딩 점검 (PROC-001/002/004)

- **representation(PROC-001)**: SC-019 e2e 단언은 `response.body` 객체 속성 직접 접근(`toHaveProperty`). f-string→%-style 류 템플릿 변경 무관. isAdmin 추가는 직렬화 JSON 에 키 1개 추가뿐 → 기존 단언 representation 불변. **PASS 유지 확정**.
- **바인딩(PROC-002)**: getProfile/AdminGuard 의존 바인딩 형태(함수로컬↔모듈레벨, 인스턴스 캐싱) 변경 없음. mock patch target 무효화 위험 없음.
- **caplog/propagate(PROC-004)**: 본 spec 로그 출력 검증 테스트 없음 — 해당 없음.

---

## 외부 라이브러리·기존 코드 실제 동작 확인

> plan.md "외부 라이브러리·기존 코드 동작 검증" 표를 코드 직접 인용으로 재확인. (신규 외부 라이브러리 도입 없음 — `@playwright/test`·vitest·@testing-library 는 테스트 도구로 API 동작 검증 대상 아님.)

| 검증 항목 | 확인 소스(라인) | 실제 동작 | plan 가정 일치? |
|---|---|---|---|
| `ADMIN_USER_IDS` 판정 | `admin.guard.ts:26-34` | `process.env['ADMIN_USER_IDS'] ?? ''` → split(',')·trim·빈값필터 → `adminIds.length===0 || !includes(userId)` 면 거부(fail-closed) | 일치. `isAdminUserId` 헬퍼가 동일 로직 추출 |
| `getProfile` 반환 | `auth.service.ts:172-178` | `findUserById` → `{id, email, createdAt}`. 미존재 → `UnauthorizedException` | 일치. isAdmin 추가 지점 명확 |
| `AuthProfileResponse` | `auth-response.dto.ts:25-34` | `{id, email, createdAt(string,date-time)}` 문서 전용 DTO(런타임 변환 없음) | 일치. `isAdmin!: boolean` 추가 |
| presign 계약 | `file.service.ts:37-66` | `purpose`·`contentType` 입력. contentType ∉ `ALLOWED_CONTENT_TYPES` → 400. key=`${purpose}/${userId}/${uuid}`. 반환 `{id, key, uploadUrl, url}`. url=publicUrl(presign 시점 확정) | 일치. **purpose 는 key prefix 전용**(contentType allowlist 와 무관) |
| confirm 계약 | `file.service.ts:88-101` | size 정수·1..`MAX_FILE_SIZE_BYTES`(10MiB) 외 400. 미존재 404, 타인 소유 403, 이미 UPLOADED 멱등. PENDING→UPLOADED | 일치 |
| `ALLOWED_CONTENT_TYPES`/`MAX_FILE_SIZE_BYTES` | `file.constants.ts` | `['image/jpeg','image/png','image/webp','image/gif']` / `10*1024*1024` | NFR-002 동일 기준. console 상수 동기 필요 |
| `FilePurpose` enum | `schema.prisma:694-698` | **`PRODUCT_IMAGE`·`REVIEW_IMAGE`·`PROFILE`** (BANNER·PRODUCT 부재) | **불일치 → GAP-001**. plan `'PRODUCT'\|'BANNER'` 가정 오류. 해소: 상품·배너 모두 `PRODUCT_IMAGE` 사용(key prefix 전용·기능 무해) |
| 상품 이미지 엔드포인트 | `product.controller.ts` (검증 by Planning), `add-image.dto.ts` | `POST /products/:id/images {url, displayOrder?}`(201), `DELETE /products/:id/images/:imageId`(204). 10개 초과 400 | 일치 |
| `ProductDetailResponse.images` | `shared-types index.ts:204` `Product.images?: ProductImage[]` | `getProduct(id)` 반환 `Product` 에 `images?` 포함. ACTIVE/OUT_OF_STOCK 만(DRAFT/INACTIVE 404) | 일치(한계 L1) |
| api-client `catalog.addImage` | `api-client index.ts:140` | `http.post<ProductImage>('/products/'+id+'/images', body)` 존재 | 일치. `deleteImage`·`files` 그룹 신규 추가 |
| HttpClient 메서드 | `http.ts:46-55` | `get`·`post`·`delete` 존재. `put` 없음 | presigned PUT 은 plain `fetch`(ADR-002) — http.put 불요 |
| console 토큰 저장 | `token-store.ts`, `config.ts:5` | localStorage(`doa.console.accessToken`/`refreshToken`). 쿠키 미사용 | **불일치 위험** → 쿠키 미러링(ADR-003)으로 middleware 가독 가능화 |
| auth.tsx isAdmin | `auth.tsx:107` | `isAdmin: false` 하드코딩 | FR-005 변경 지점 |
| dashboard nav | `layout.tsx:52-53` | admin 섹션 무조건 노출, seller 만 `isSeller` 필터 | FR-007 변경 지점 |

---

## 인정되는 한계 및 안전망 (PATCH-A07)

plan.md 한계 L1~L3 를 코드 근거로 재확인(중복 상세 생략, plan "인정되는 한계" 참조):

- **L1. 상품 이미지 섹션 표시 조건**: `getProduct` 가 DRAFT/INACTIVE 404(페이지 L39-40 `notFound` 분기). → 안전망: 이미지 섹션을 `detail.data` 블록(L61) 내에만 배치. DRAFT 는 기존 `DraftPanel`(L50-59).
- **L2. middleware 쿠키 신뢰 한계**: 미러링 쿠키는 비-HttpOnly(JS 기록) → 위변조 가능. middleware 는 UX 계층. → 안전망: 백엔드 AdminGuard(무변경, 최종 방어선) + admin API 403 → `<ErrorState>` 403 분기.
- **L3. StubFileStorage vs 실 R2**: presigned PUT 은 현재 stub(결정적 URL) 기준. 단위 테스트는 fetch mock → 실 R2 미검증. → 안전망: NFR-003 단계별 오류(SC-006) + 사후 운영 검증(spec PROC-014 시나리오 1).

---

## 배포 환경 영향 추정 (PATCH-A10)

> plan.md "기술 컨텍스트 — 배포 환경 영향(PROC-009)" 와 cross-reference.

- console 은 Vercel 자동 배포, 백엔드는 Fly.io(infra.md §2). 본 spec 은 배포 토폴로지·컨테이너·CI 무변경.
- **middleware 런타임**: Next.js `middleware.ts` 는 Vercel Edge(또는 Node) 표준 Web API(`NextRequest`/`NextResponse`)만 사용 — Fly.io 전용 의존 없음, 컨테이너 NAT/LB/conntrack 등 socket-level 환경 특이성과 무관(미들웨어는 HTTP 라우팅 레이어, TCP keepalive·half-close 영향권 아님). → 점검 대상 환경 특이성 **해당 없음**.
- **신규 의존 배포 영향**: `@playwright/test`·vitest·@testing-library 는 devDependency(로컬 전용). 백엔드 Fly 이미지·console Vercel 빌드에 포함되지 않음(production 빌드는 devDep 제외). Docker 빌드 산출물 경로 정합성(PROC-003) — 본 spec 은 Dockerfile/docker-compose 무변경, 컨테이너화 SC 없음 → docker build 검증 태스크 불요.
- `ADMIN_USER_IDS`(백엔드 secret)·`NEXT_PUBLIC_API_URL`(console)·`CORS_ORIGIN` 기존 환경변수 재사용(신규 0). infra.md §8 `AdminGuard fail-closed`: `ADMIN_USER_IDS` 미설정 시 전원 비관리자 → middleware `/admin/*` 전체 차단(spec 사후검증 시나리오 2, 의도된 동작).

---

## context.md 부정합 사전 점검 (PATCH-A11)

> 변경 대상 심볼을 `.claude/docs/context.md` §2·§5 에서 grep 추출하여 변경 후 정의 유효성 평가.

- 추출 결과: §2 L103 `shared/auth` = `JwtStrategy · ... · AdminGuard(ADMIN_USER_IDS env 기반, fail-closed) · @CurrentUser`. (§5 도메인 용어 사전에 isAdmin/AuthProfile/ImageUpload 항목 부재.)
- 평가:
  - `AdminGuard(ADMIN_USER_IDS env 기반, fail-closed)` — 변경 후에도 **유효**(AdminGuard 는 여전히 env 기반·fail-closed, 파싱만 헬퍼 위임). 오류 부정합 아님.
  - 미반영(현행화 누락): (a) 공유 헬퍼 `admin-ids.ts`(`isAdminUserId`) 존재, (b) `GET /auth/me` isAdmin 노출. → **GAP-002** 등록(6단계 Docs Agent 현행화 위임).
- 본 spec 은 신규 클래스/Enum 의미 변경·필드 의미 변경 없음(isAdmin 은 도출 값, DB 컬럼 아님). 그 외 context.md 항목 부정합 없음.

---

## 기술 선택 조사

> plan.md ADR-001~006 표가 단일 소스. research 측 cross-check 결과 6개 ADR 모두 근거·대안·영향 명시되어 누락 없음. 추가 조사 항목:

- **vitest + @testing-library/react 채택(console 단위/통합 러너)**: console 에 현재 단위 테스트 러너 미구성(`package.json` 에 vitest/jest/@testing-library 없음 — grep 0건). [env:unit]/[env:integration] SC(SC-004~010·012·017·019)는 컴포넌트 렌더·상호작용·fetch mock 검증을 요구하므로 러너 필수 전제. Next.js 15 + React 19 환경에서 vitest(jsdom) + @testing-library/react 가 표준. 본 러너 구성은 D 레이어(5a Test Agent) 테스트 인프라 소유로 분해(plan.md "기타 고려사항 — console 단위/통합 테스트 러너" 위임 반영).
- **Playwright(E2E)**: ADR-005. 로컬 `next dev`(:3100) + backend dev 전제(ASM-005). `[env:e2e-docker]` 태그 SC(015·016·021~025)는 옵션 A(사용자 로컬 실행 — main session 사용자 결정)로 실행 defer. 테스트 파일은 작성(SC-020 정적 검증은 파이프라인 내).

---

## 엣지 케이스 및 한계

- **동일 파일 재선택**: `<input type="file">` 가 동일 파일 재선택 시 `onChange` 미발화 → 업로드 후 `input.value = ''` reset.
- **업로드 중 다이얼로그 닫힘**: 내부 도구 수준 — abort 불요, 단순 무시(컴포넌트 unmount 시 콜백 미실행 가드).
- **confirm 실패 시 부분 상태**: 파일은 R2 에 PUT 됐으나 PENDING 유지(confirm 미완). → "업로드는 됐으나 확정 실패 — 재시도" 안내(NFR-003). 재시도 시 동일 file id 로 confirm 멱등.
- **10장 경계(SC-010)**: `images.length >= 10` → ImageUpload `disabled`. 백엔드도 10 초과 400(이중 방어).
- **배너 purpose 의미 차선택(GAP-001)**: `PRODUCT_IMAGE` 를 배너에 사용 — storage key prefix 만의 영향(기능 무해). enum 확장은 범위 외.
- **쿠키 만료 미동기**: 토큰 만료 시 미러링 쿠키 잔존 가능 → middleware coarse 게이트 통과하나 api 401 → `onAuthExpired` 가 `/login` 강제(실질 게이트 유지). middleware 는 정확한 만료 동기화 비요구.
