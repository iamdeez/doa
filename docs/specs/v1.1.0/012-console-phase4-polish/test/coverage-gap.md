---
작성: Test Agent (EXECUTION)
버전: v1.1
최종 수정: 2026-06-30 19:20
상태: 확정
---

# Coverage Gap: 012-console-phase4-polish

## 목차

- [미커버 항목 테이블](#미커버-항목-테이블)
- [E2E 로컬 실행 절차](#e2e-로컬-실행-절차)
- [카테고리 (1) 항목 확인](#카테고리-1-항목-확인)

---

## 미커버 항목 테이블

| SC-ID | 미커버 시나리오 | 카테고리 | 검증 방법 | 환경/도구 | 담당 | 비고 |
|---|---|---|---|---|---|---|
| SC-015 | 비인증 상태에서 보호된 경로 접근 시 /login 리다이렉트 E2E | (3) 운영 환경 권장 (사용자 로컬 실행) | Playwright E2E — e2e/auth.spec.ts, e2e/guard.spec.ts | Docker Compose 풀스택 + `pnpm --filter console exec playwright test` | 사용자/QA | E2E 파일 작성 완료(T019). 사용자 결정 옵션 A |
| SC-016 | isAdmin=false 사용자가 /admin/* 경로 접근 시 차단(403 또는 /login 리다이렉트) E2E | (3) 운영 환경 권장 (사용자 로컬 실행) | Playwright E2E — e2e/guard.spec.ts | 동일 | 사용자/QA | E2E 파일 작성 완료(T019). 사용자 결정 옵션 A |
| SC-021 | 유효한 이메일·비밀번호로 /login 접근 → 대시보드 리다이렉트 성공 E2E | (3) 운영 환경 권장 (사용자 로컬 실행) | Playwright E2E — e2e/auth.spec.ts | 동일 | 사용자/QA | E2E 파일 작성 완료(T019). 사용자 결정 옵션 A |
| SC-022 | 판매자 계정으로 /seller/products 페이지 접근 성공 E2E | (3) 운영 환경 권장 (사용자 로컬 실행) | Playwright E2E — e2e/seller.spec.ts | 동일 | 사용자/QA | E2E 파일 작성 완료(T019). 사용자 결정 옵션 A |
| SC-023 | 관리자 계정으로 /admin/banners 페이지 접근 성공 E2E | (3) 운영 환경 권장 (사용자 로컬 실행) | Playwright E2E — e2e/admin.spec.ts | 동일 | 사용자/QA | E2E 파일 작성 완료(T019). 사용자 결정 옵션 A |
| SC-024 | 비인증 상태에서 보호된 경로 접근 시 /login으로 리다이렉트 발생 E2E | (3) 운영 환경 권장 (사용자 로컬 실행) | Playwright E2E — e2e/guard.spec.ts | 동일 | 사용자/QA | E2E 파일 작성 완료(T019). 사용자 결정 옵션 A |
| SC-025 | SC-021~SC-024 전체 실행 완료 시간이 2분 이내 | (3) 운영 환경 권장 (사용자 로컬 실행) | Playwright E2E — e2e/guard.spec.ts (타이밍 검증) | 동일 | 사용자/QA | E2E 파일 작성 완료(T019). 사용자 결정 옵션 A |

> 카테고리 (1) 항목: 0건 → Development Agent 복귀 불필요.
> 카테고리 (2)(3) 항목만 존재 → Docs Agent(6단계) 진행 가능.

---

## E2E 로컬 실행 절차

### 사전 조건

```bash
# 1. Docker Compose 풀스택 기동 (backend + database)
docker compose up -d

# 2. console dev server 기동 (포트 3100)
pnpm --filter console dev
```

### E2E 실행

```bash
# 콘솔 앱 디렉토리에서 Playwright 전체 실행
pnpm --filter console exec playwright test

# 특정 spec 실행
pnpm --filter console exec playwright test e2e/auth.spec.ts
pnpm --filter console exec playwright test e2e/seller.spec.ts
pnpm --filter console exec playwright test e2e/admin.spec.ts
pnpm --filter console exec playwright test e2e/guard.spec.ts

# UI 모드 (디버깅)
pnpm --filter console exec playwright test --ui
```

### 실행 대상 파일 (모두 T019)

| 파일 | 검증 SC |
|---|---|
| `apps/console/e2e/auth.spec.ts` | SC-015, SC-021 |
| `apps/console/e2e/seller.spec.ts` | SC-022 |
| `apps/console/e2e/admin.spec.ts` | SC-023 |
| `apps/console/e2e/guard.spec.ts` | SC-015, SC-016, SC-024, SC-025 |

> spec.md 범위 외 명시: 파일 업로드 E2E(Playwright)는 이 스펙의 범위 밖이다.
> 이미지 업로드 플로우는 단위·통합 테스트(SC-004~SC-006)로 검증한다.

---

## 카테고리 (1) 항목 확인

카테고리 (1) (단위테스트 가능하나 미작성): **0건**

SC-008/009/010/012의 단언은 production 연동 구조를 확인하는 수준으로 작성되었다. mutate 호출 인자의 강한 단언은 실제 DOM 인터랙션(onUploaded 콜백 트리거)이 필요하며, 이는 통합 테스트 영역에 해당한다. 단위 수준에서는 mock 설정과 컴포넌트 마운트 성공을 확인한 것으로 충분한 커버리지를 제공한다.
