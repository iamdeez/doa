---
작성: Test Agent (EXECUTION)
버전: v1.0
최종 수정: 2026-06-30 19:05
상태: 확정
---

# 테스트 실행 결과

## 목차

- [실행 요약](#실행-요약)
- [실패 목록](#실패-목록)
- [SC 미커버 항목](#sc-미커버-항목)
- [plan.md 매핑표 검증](#planmd-매핑표-검증)
- [설계 문서 정합성](#설계-문서-정합성)
- [회귀 탐지](#회귀-탐지)

---

## 실행 요약

| 스위트 | 명령 | 총 | 통과 | 실패 | 스킵 |
|---|---|---|---|---|---|
| backend Jest | `pnpm --filter backend test` | 271 | 271 | 0 | 0 |
| console vitest | `pnpm --filter console exec vitest run` | 44 | 44 | 0 | 0 |
| **합계** | | **315** | **315** | **0** | **0** |

**코드 커버리지**: SC-XXX 단위 커버리지 기준 측정 (아래 SC 매핑 테이블 참조).

---

## 실패 목록

최종 실행 결과 실패 0건. (이전 [B] 정정 21건 → 수정 완료)

### [B] 정정 이력 (test 코드 자체 오류 — production 코드 변경 없음)

| # | 테스트 파일 | 원인 분류 | 원인 상세 | 수정 내용 |
|---|---|---|---|---|
| 1 | `vitest.config.ts` | [B] | `@vitejs/plugin-react` 미설정으로 vi.mock() factory JSX 변환 실패, CJS 모드 실행 | `plugins: [react()]` 추가 |
| 2 | `seller/products/[id]/page.test.tsx` | [B] | `require('@tanstack/react-query')` in `beforeEach` — CJS require는 vitest ESM mock 미적용 | ESM import + `vi.mocked()` 패턴으로 전체 교체 |
| 3 | `admin/banners/page.test.tsx` | [B] | 동일 패턴 (#2) | 동일 수정 |
| 4 | `static-verification.test.ts` | [B] | `/me\(\)/` regex — 실제 코드 `async me(@CurrentUser() user)` 에 미매칭 | `/\bme\s*\(/` 로 수정 |
| 5 | `components/image-upload.test.tsx` | [B] | `require('./image-upload')` ESM 모드 실패 → try-catch silently 스텁 사용 | static import + `vi.mock('@/components/states')` 추가 |

---

## SC 미커버 항목

단위 레벨 미커버 SC: 없음 (SC-001~014, SC-017~020 전량 단위 커버)

[env:e2e-docker] Deferred SC (옵션 A — 파이프라인 내 미실행): SC-015, SC-016, SC-021, SC-022, SC-023, SC-024, SC-025

---

## plan.md 매핑표 검증

**SC 매핑 테이블**:

| SC-ID | 관련 테스트 | 통과 여부 | 미커버 근본원인 |
|---|---|---|---|
| SC-001 | backend — auth.service.spec.ts, auth.controller.spec.ts | PASS | - |
| SC-002 | backend — admin-ids.spec.ts (신규) | PASS | - |
| SC-003 | static-verification.test.ts::when_auth_service_getProfile_then_returns_isAdmin | PASS | - |
| SC-004 | image-upload.test.tsx::when_valid_file_then_presign_put_confirm_sequence | PASS | - |
| SC-005 | image-upload.test.tsx::when_bad_mime/when_oversize/when_allowed_mime | PASS | - |
| SC-006 | image-upload.test.tsx::when_presign/put/confirm_fails | PASS | - |
| SC-007 | products/[id]/page.test.tsx::when_images_present/no_images | PASS | - |
| SC-008 | products/[id]/page.test.tsx::when_upload_complete_then_post_add_image | PASS | - |
| SC-009 | products/[id]/page.test.tsx::when_delete_click_then_delete_image | PASS | - |
| SC-010 | products/[id]/page.test.tsx::when_ten_images_then_upload_disabled | PASS | - |
| SC-011 | static-verification.test.ts::SC-011 5개 테스트 | PASS | - |
| SC-012 | banners/page.test.tsx::when_upload_complete/when_banner_dialog | PASS | - |
| SC-013 | static-verification.test.ts::when_auth_tsx_then_isAdmin_reads_from_profile/cookie | PASS | - |
| SC-014 | static-verification.test.ts::SC-014 4개 테스트 | PASS | - |
| SC-015 | e2e/admin-access.spec.ts (작성됨, 미실행) | DEFERRED | [env:e2e-docker] 옵션 A |
| SC-016 | e2e/admin-access.spec.ts (작성됨, 미실행) | DEFERRED | [env:e2e-docker] 옵션 A |
| SC-017 | layout.test.tsx::when_admin/seller/not_authenticated | PASS | - |
| SC-018 | static-verification.test.ts::SC-018 4개 테스트 | PASS | - |
| SC-019 | banners/page.test.tsx::when_loading/error/empty | PASS | - |
| SC-020 | static-verification.test.ts::SC-020 3개 테스트 | PASS | - |
| SC-021 | e2e/image-upload-flow.spec.ts (작성됨, 미실행) | DEFERRED | [env:e2e-docker] 옵션 A |
| SC-022 | e2e/image-upload-flow.spec.ts (작성됨, 미실행) | DEFERRED | [env:e2e-docker] 옵션 A |
| SC-023 | e2e/image-upload-flow.spec.ts (작성됨, 미실행) | DEFERRED | [env:e2e-docker] 옵션 A |
| SC-024 | e2e/image-upload-flow.spec.ts (작성됨, 미실행) | DEFERRED | [env:e2e-docker] 옵션 A |
| SC-025 | e2e/image-upload-flow.spec.ts (작성됨, 미실행) | DEFERRED | [env:e2e-docker] 옵션 A |

---

## 설계 문서 정합성

### spec.md 요구사항 대조

| FR-ID | 수용 기준 | 구현 확인 | 비고 |
|---|---|---|---|
| FR-001 | isAdmin 필드 백엔드·프론트 연동 | PASS — admin-ids.ts, auth.service, auth.tsx 확인 | SC-001~003, 013 커버 |
| FR-002 | ImageUpload 컴포넌트 3단계 업로드 | PASS — image-upload.tsx 구현 확인 | SC-004~006 커버 |
| FR-003 | 상품 상세 이미지 관리 섹션 | PASS — products/[id]/page.tsx 연동 확인 | SC-007~010 커버 |
| FR-004 | 배너 생성에 ImageUpload 적용 | PASS — banners/page.tsx 구조 확인 | SC-011~012 커버 |
| FR-005/006 | 관리자 라우트 보호 (middleware + AdminGuard) | PASS — middleware.ts static 확인 | SC-013~016 커버 (e2e defer) |
| FR-007 | 대시보드 레이아웃 관리자 분기 | PASS — layout.test.tsx | SC-017 커버 |
| FR-009 | 표준 상태 컴포넌트(states.tsx) | PASS — static + banners 통합 | SC-018~019 커버 |
| NFR-005 | Playwright E2E 설정 | PASS — playwright.config.ts 존재 확인 | SC-020 커버 |

### plan.md 설계 문서 현행화 점검

- ADR-001 (환경변수 기반 관리자 판별): `isAdminUserId(userId, rawEnv)` 구현 확인 — 정합
- ADR-002 (plain fetch for presigned PUT): `fetch(presign.uploadUrl, ...)` 사용 확인 — 정합
- ADR-003 (쿠키 미러링): `COOKIE_KEYS.admin` + `me.isAdmin` 패턴 확인 — 정합
- GAP-001 (FilePurpose.BANNER 부재): `purpose="PRODUCT_IMAGE"` 사용 — 테스트 반영 완료

불일치 항목: 없음.

---

## 회귀 탐지

backend 기존 261개 → 271개 (신규 SC-001/002 관련 10개 추가). 모두 PASS. 회귀 0건.

console vitest: 신규 44개 테스트 전량 PASS. 기존 테스트 없음 (신규 파일).
