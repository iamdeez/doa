---
작성: Test Agent (EXECUTION)
버전: v1.1
최종 수정: 2026-06-30 19:20
상태: 확정
---

# Coverage: 012-console-phase4-polish

## 목차

- [SC 커버리지 매트릭스](#sc-커버리지-매트릭스)
- [실행 요약](#실행-요약)
- [Deferred SC (env:e2e-docker)](#deferred-sc-enve2e-docker)
- [STALE_SC 경고](#stale_sc-경고)

---

## SC 커버리지 매트릭스

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | plan.md 시나리오 전체 | 상태 |
|---|---|---|---|---|---|---|
| SC-001 | GET /auth/me 응답에 isAdmin 포함 | backend 단위 PASS | - | - | O | PASS (backend 271) |
| SC-002 | admin-ids.ts isAdminUserId 정상 동작 | backend 단위 PASS | O (환경변수 누락·빈값) | O (미일치) | O | PASS (backend 271) |
| SC-003 | GET /auth/me — isAdmin: false (비관리자) | static-verification PASS | - | - | O | PASS (static) |
| SC-004 | ImageUpload: presign→PUT→confirm→onUploaded | PASS (image-upload.test.tsx) | - | - | O | PASS |
| SC-005 | MIME 불허·10MiB 초과 클라이언트 검증 차단 | PASS × 2 (mime·size) | O | - | O | PASS |
| SC-006 | presign/PUT/confirm 단계별 실패 → 오류 표시 | PASS × 3 | - | O (각 단계) | O | PASS |
| SC-007 | 상품 상세 이미지 섹션·목록 렌더 | PASS (2장·0장) | O | - | O | PASS |
| SC-008 | 이미지 업로드 완료 후 POST /products/:id/images | PASS (구조 확인) | - | - | Partial | PASS* |
| SC-009 | 삭제 버튼 → DELETE /products/:id/images/:imageId | PASS (구조 확인) | - | - | Partial | PASS* |
| SC-010 | 이미지 10장 시 추가 버튼 비활성 | PASS (구조 확인) | - | - | Partial | PASS* |
| SC-011 | ImageUpload 컴포넌트 파일·인터페이스 정적 확인 | PASS (static) | - | - | O | PASS |
| SC-012 | 배너 생성 다이얼로그에서 ImageUpload 사용 | PASS (구조·다이얼로그) | - | - | Partial | PASS* |
| SC-013 | auth.tsx isAdmin → profile?.isAdmin ?? false | PASS (static) | - | - | O | PASS |
| SC-014 | middleware.ts /admin/* 쿠키 기반 보호 | PASS (static × 4) | - | - | O | PASS |
| SC-015 | 비인증 상태에서 보호된 경로 접근 시 /login으로 리다이렉트 | - | - | - | - | DEFERRED (e2e-docker) |
| SC-016 | isAdmin=false 사용자가 /admin/* 경로 접근 시 차단(403 또는 /login 리다이렉트) | - | - | - | - | DEFERRED (e2e-docker) |
| SC-017 | 대시보드 레이아웃 isAdmin 상태 분기 렌더 | PASS (layout.test.tsx × 3) | - | - | O | PASS |
| SC-018 | states.tsx LoadingState/ErrorState/EmptyState export | PASS (static × 3) | - | - | O | PASS |
| SC-019 | 배너 목록 LoadingState/ErrorState/EmptyState 렌더 | PASS × 3 (banners.test.tsx) | - | - | O | PASS |
| SC-020 | playwright.config.ts 설정 파일 존재·값 | PASS (static) | - | - | O | PASS |
| SC-021 | 유효한 이메일·비밀번호로 /login 접근 → 대시보드 리다이렉트 성공 | - | - | - | - | DEFERRED (e2e-docker) |
| SC-022 | 판매자 계정으로 /seller/products 페이지 접근 성공 | - | - | - | - | DEFERRED (e2e-docker) |
| SC-023 | 관리자 계정으로 /admin/banners 페이지 접근 성공 | - | - | - | - | DEFERRED (e2e-docker) |
| SC-024 | 비인증 상태에서 보호된 경로 접근 시 /login으로 리다이렉트 발생 | - | - | - | - | DEFERRED (e2e-docker) |
| SC-025 | SC-021~SC-024 전체 실행 완료 시간이 2분 이내 | - | - | - | - | DEFERRED (e2e-docker) |

> \* SC-008/009/010/012: 구현 연동 단언 일부 — TDD 구조는 갖춤. production 연동 완료 후 단언 강화 가능.
> DEFERRED: [env:e2e-docker] 항목. 옵션 A(사용자 로컬 실행) 결정으로 파이프라인 내 미실행.

---

## 실행 요약

| 스위트 | 총 테스트 | 통과 | 실패 | 스킵 |
|---|---|---|---|---|
| backend Jest | 271 | 271 | 0 | 0 |
| console vitest — static-verification | 24 | 24 | 0 | 0 |
| console vitest — image-upload | 7 | 7 | 0 | 0 |
| console vitest — layout | 3 | 3 | 0 | 0 |
| console vitest — banners | 5 | 5 | 0 | 0 |
| console vitest — products/[id] | 5 | 5 | 0 | 0 |
| **합계** | **315** | **315** | **0** | **0** |

### [B] 정정 이력 (테스트 코드 자체 오류 수정)

총 21건의 [B] 테스트 오류를 발견·수정하였다. production 코드는 변경 없음.

| 파일 | 원인 | 수정 내용 |
|---|---|---|
| `vitest.config.ts` | `@vitejs/plugin-react` 미설정 → JSX 변환 실패 | `plugins: [react()]` 추가 |
| `products/[id]/page.test.tsx` | `require('@tanstack/react-query')` CJS → ESM mock 미적용 | ESM import + `vi.mocked()` 패턴으로 교체 |
| `admin/banners/page.test.tsx` | 동일 패턴 | 동일 수정 |
| `static-verification.test.ts` | `/me\(\)/` regex — `me(@CurrentUser()...)` 미매칭 | `/\bme\s*\(/` 로 수정 |
| `components/image-upload.test.tsx` | `require('./image-upload')` ESM 모드 실패 → 스텁 사용 | static import + `@/components/states` mock 추가 |

---

## Deferred SC (env:e2e-docker)

파이프라인 내 미실행 SC: SC-015, SC-016, SC-021, SC-022, SC-023, SC-024, SC-025 (총 7건)

사용자 결정: **옵션 A** — 로컬 실행 (파이프라인 내 defer)

| SC-ID | 수용 기준 | 검증 파일 | 태스크 |
|---|---|---|---|
| SC-015 | 비인증 상태 보호 경로 접근 → /login 리다이렉트 | e2e/auth.spec.ts, e2e/guard.spec.ts | T019 |
| SC-016 | isAdmin=false 사용자 /admin/* 접근 시 차단 | e2e/guard.spec.ts | T019 |
| SC-021 | 유효 로그인 → 대시보드 리다이렉트 성공 | e2e/auth.spec.ts | T019 |
| SC-022 | 판매자 계정 /seller/products 접근 성공 | e2e/seller.spec.ts | T019 |
| SC-023 | 관리자 계정 /admin/banners 접근 성공 | e2e/admin.spec.ts | T019 |
| SC-024 | 비인증 보호 경로 접근 → /login 리다이렉트 | e2e/guard.spec.ts | T019 |
| SC-025 | SC-021~024 2분 이내 완료 | e2e/guard.spec.ts | T019 |

실행 절차: `coverage-gap.md §E2E 로컬 실행 절차` 참조.

---

## STALE_SC 경고

검출 범위: 본 차수(012) git diff 변경 파일.

`apps/backend/src/modules/auth/auth.service.spec.ts` 내 SC-010·013·014·016·017 참조는 `(v1.0.0/001 spec)` 출처 주석이 동일 docstring 내 존재 → PATCH-A18 rule(1) silence 적용. STALE_SC 경고 0건.

```
stale_sc:
  count: 0
  decision: NONE_FOUND
```
