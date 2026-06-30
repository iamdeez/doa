---
작성: Test Agent (AUTHORING)
버전: v1.0
최종 수정: 2026-06-30 17:54
상태: 작성중
---

# Test Cases: 012-console-phase4-polish

## 목차

- [SC × 시나리오 매트릭스](#sc--시나리오-매트릭스)
- [외부 의존성 명시](#외부-의존성-명시)
- [미커버 항목 (사전 분류 — 4-카테고리)](#미커버-항목-사전-분류--4-카테고리)

---

## SC × 시나리오 매트릭스

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | 테스트 파일·함수 | env 태그 |
|---|---|---|---|---|---|---|
| SC-001 | getProfile 응답에 isAdmin 포함 | `when_getProfile_then_isAdmin_in_response` | — | — | `apps/backend/src/modules/auth/auth.service.spec.ts` | [env:unit] |
| SC-002 | env 포함→true / 미포함→false / 미설정→false | `when_admin_user_id_in_env_then_isAdmin_true` | `when_env_unset_then_isAdmin_false` | `when_user_not_in_env_then_isAdmin_false` | `apps/backend/src/shared/auth/admin-ids.spec.ts` | [env:unit] |
| SC-003 | 기존 백엔드 테스트 261개 PASS + 신규 추가 | (기존 전량 회귀 통과 — Jest 러너 확인) | — | — | 전체 backend 스위트 (`pnpm --filter backend test`) | [env:unit] |
| SC-004 | ImageUpload 3단계 순서 호출 | `when_valid_file_then_presign_put_confirm_sequence` | — | — | `apps/console/components/image-upload.test.tsx` | [env:unit] |
| SC-005 | MIME 불허/10MiB 초과 → presign 미호출 | — | `when_bad_mime_then_no_presign` / `when_oversize_then_no_presign` | — | `apps/console/components/image-upload.test.tsx` | [env:unit] |
| SC-006 | 각 단계 실패 시 오류 메시지 | — | — | `when_presign_fails_then_error_shown` / `when_put_fails_then_error_shown` / `when_confirm_fails_then_error_shown` | `apps/console/components/image-upload.test.tsx` | [env:unit] |
| SC-007 | 상품 상세 이미지 섹션·목록 렌더 | `when_images_present_then_grid_rendered` | — | — | `apps/console/app/(dashboard)/seller/products/[id]/page.test.tsx` | [env:integration] |
| SC-008 | 업로드 완료 후 POST images 호출 | `when_upload_complete_then_post_add_image` | — | — | `apps/console/app/(dashboard)/seller/products/[id]/page.test.tsx` | [env:integration] |
| SC-009 | 삭제 버튼 → DELETE images 호출 | `when_delete_click_then_delete_image_called` | — | — | `apps/console/app/(dashboard)/seller/products/[id]/page.test.tsx` | [env:integration] |
| SC-010 | 이미지 10장 시 추가 버튼 비활성 | — | `when_ten_images_then_upload_disabled` | — | `apps/console/app/(dashboard)/seller/products/[id]/page.test.tsx` | [env:unit] |
| SC-011 | banner 폼 imageUrl 영역이 ImageUpload 사용 | `test_banner_form_uses_image_upload_grep` | — | — | 정적 grep (T018 내) | [env:static] |
| SC-012 | 배너 생성 시 업로드 URL이 imageUrl로 전송 | `when_upload_complete_then_create_banner_with_url` | — | — | `apps/console/app/(dashboard)/admin/banners/page.test.tsx` | [env:integration] |
| SC-013 | auth.tsx isAdmin = profile?.isAdmin | `test_auth_tsx_isAdmin_uses_profile_grep` | — | — | 정적 grep (T018 내) | [env:static] |
| SC-014 | middleware.ts 존재 + config.matcher 설정 | `test_middleware_exists_with_matcher_grep` | — | — | 정적 파일 존재 확인 (T018 내) | [env:static] |
| SC-015 | 비인증 보호경로 → /login 리다이렉트 | — | — | `test_when_unauth_protected_then_redirect_to_login` | `apps/console/e2e/guard.spec.ts` | [env:e2e-docker] (실행 defer) |
| SC-016 | 비관리자 /admin/* → 차단 | — | — | `test_when_nonadmin_admin_route_then_blocked` | `apps/console/e2e/guard.spec.ts` | [env:e2e-docker] (실행 defer) |
| SC-017 | isAdmin=false 시 admin nav 항목 숨김 | `when_isAdmin_true_then_admin_nav_shown` | `when_isAdmin_false_then_admin_nav_hidden` | — | `apps/console/app/(dashboard)/layout.test.tsx` | [env:unit] |
| SC-018 | states.tsx 3개 컴포넌트 존재 | `test_states_components_exist_grep` | — | — | 정적 파일 존재 확인 (T018 내) | [env:static] |
| SC-019 | 변경 페이지에 표준 컴포넌트 적용 | `when_loading_then_loading_state_rendered` / `when_error_then_error_state_rendered` / `when_empty_then_empty_state_rendered` | — | — | banner/product page.test.tsx | [env:integration] |
| SC-020 | @playwright/test devDep + playwright.config.ts 존재 | `test_playwright_devdep_and_config_exist_grep` | — | — | 정적 파일 존재 확인 (T018 내) | [env:static] |
| SC-021 | 유효 계정 로그인 → 대시보드 리다이렉트 | `test_when_valid_login_then_dashboard_redirect` | — | — | `apps/console/e2e/auth.spec.ts` | [env:e2e-docker] (실행 defer) |
| SC-022 | 판매자 계정 /seller/products 접근 성공 | `test_seller_products_page_accessible` | — | — | `apps/console/e2e/seller.spec.ts` | [env:e2e-docker] (실행 defer) |
| SC-023 | 관리자 계정 /admin/banners 접근 성공 | `test_admin_banners_page_accessible` | — | — | `apps/console/e2e/admin.spec.ts` | [env:e2e-docker] (실행 defer) |
| SC-024 | 비인증 보호경로 → /login 리다이렉트 (E2E) | — | — | `test_when_unauth_then_login_redirect` | `apps/console/e2e/guard.spec.ts` | [env:e2e-docker] (실행 defer) |
| SC-025 | E2E 4개 시나리오 ≤ 2분 | `test_e2e_suite_under_2_minutes` | — | — | 러너 리포트 측정 (playwright.config.ts timeout 설정) | [env:e2e-docker] (실행 defer) |

> **역방향 검증**: FR-001~FR-011 모두 대응 SC 존재 확인 — SC 없는 FR 0건. [PASS]

---

## 외부 의존성 명시

### 백엔드 테스트 (T012 — Jest)

- **러너**: 기존 `pnpm --filter backend test` (Jest)
- **mock**: `process.env['ADMIN_USER_IDS']` 변형 (테스트 내 환경변수 직접 설정·복원)
- **환경변수**: `ADMIN_USER_IDS` (테스트 내 override)
- **픽스처**: 기존 `FIXED_USER` 패턴 (auth.service.spec.ts 기존 참조)

### console 단위/통합 테스트 (T014~T017 — vitest + RTL)

- **러너**: `pnpm --filter console test` (vitest — T013에서 구성)
- **mock**:
  - `@/lib/api` — api client 전체 mock (vi.mock)
  - `@/lib/auth` — useAuth mock (vi.mock + vi.fn())
  - `next/navigation` — useRouter, usePathname mock
  - `global.fetch` — ImageUpload PUT 단계용 (vi.fn())
- **fixture**: 상품 detail mock, 이미지 목록 mock, presign 응답 mock
- **환경**: jsdom (vitest.config.ts)
- **setup**: `@testing-library/jest-dom` (vitest.setup.ts)

### E2E 테스트 (T019 — Playwright) — 실행 defer

- **러너**: `pnpm --filter console e2e` (playwright)
- **전제 환경**: backend dev 서버 기동 + console dev(:3100) 기동
- **시드 계정**: 판매자·관리자 계정 (로컬 backend dev DB)
- **환경변수**: `ADMIN_USER_IDS`에 관리자 user ID 포함
- **실행 절차 (옵션 A)**:
  1. `pnpm --filter backend dev` 기동
  2. `pnpm --filter console dev` 기동 (:3100)
  3. `pnpm --filter console e2e`

---

## 미커버 항목 (사전 분류 — 4-카테고리)

단위테스트로 검증 불가능하거나 실행 defer된 SC를 사전 분류한다.

| SC-ID | 미커버 사유 | 카테고리 | 권장 검증 방법 |
|---|---|---|---|
| SC-015 | 실제 Next.js middleware 서버측 리다이렉트 — mock 불가(미들웨어 런타임 의존) | (2) 단위테스트 불가 | E2E (Playwright) — 옵션A 사용자 로컬 실행 |
| SC-016 | 실제 쿠키 미러링 타이밍 + 미들웨어 /admin/* 차단 — 통합 런타임 필요 | (2) 단위테스트 불가 | E2E (Playwright) — 옵션A 사용자 로컬 실행 |
| SC-021 | 실제 로그인 토큰 흐름 + 백엔드 인증 — mock 불가 | (2) 단위테스트 불가 | E2E (Playwright) — 옵션A 사용자 로컬 실행 |
| SC-022 | 실제 판매자 권한 검증 + 서버 렌더링 — 통합 런타임 필요 | (2) 단위테스트 불가 | E2E (Playwright) — 옵션A 사용자 로컬 실행 |
| SC-023 | 실제 관리자 권한 검증 + 백엔드 AdminGuard — 통합 런타임 필요 | (2) 단위테스트 불가 | E2E (Playwright) — 옵션A 사용자 로컬 실행 |
| SC-024 | 실제 미들웨어 리다이렉트 + 쿠키 부재 시나리오 — E2E 필요 | (2) 단위테스트 불가 | E2E (Playwright) — 옵션A 사용자 로컬 실행 |
| SC-025 | 실행 시간 측정 — E2E 실행 후 러너 리포트 기반 | (3) 운영 환경 권장 | E2E 전체 실행 후 playwright 리포트 확인 |
| SC-003 | 기존 261개 회귀 전량 — 파이프라인 CI 범위 | (1) 단위테스트 가능 (기존 스위트 실행) | `pnpm --filter backend test` 전량 PASS 확인 (5b에서 검증) |

> **E2E defer 옵션 A 실행 절차**: main session이 backend dev + console dev(:3100) 기동 + `pnpm --filter console e2e` 절차를 사용자에게 제시 → 사용자 로컬 실행 → Test Agent(5b)가 결과 검증.
>
> **카테고리 (1) 항목**: SC-003은 단위테스트 가능하나 기존 Jest 스위트 전량 실행으로 검증 — T012에서 신규 isAdmin 테스트 추가 포함. 5b EXECUTION에서 `pnpm --filter backend test` 결과로 확인.
