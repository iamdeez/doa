---
작성: Spec Agent
버전: v1.0
최종 수정: 2026-06-30
상태: 확정
---

# Assumptions: 012-console-phase4-polish

| ID | 가정 내용 | 확인 필요 여부 | 확인 방법 |
|---|---|---|---|
| ASM-001 | StubFileStorage는 개발 환경에서 결정적 URL을 반환하며 presigned URL 흐름을 시뮬레이션한다. 실 R2 환경과의 동작 차이(실제 PUT 허용 여부)는 별도 운영 검증으로 defer한다. | 불필요 (기존 stub 동작 확인됨) | `file.service.ts` + `StubFileStorage` 구현 확인 완료 |
| ASM-002 | `ADMIN_USER_IDS` 환경변수가 백엔드에서 이미 `AdminGuard`에 사용 중이다. FR-001 구현 시 동일 환경변수를 `AuthService`에서 재사용한다. | 불필요 | `AdminGuard` 코드 확인 완료 |
| ASM-003 | 배너 편집(UpdateBannerDto) 다이얼로그는 현재 미구현 상태이므로 FR-004는 CreateBannerDialog에만 적용한다. | 불필요 | v1.1.0/007-admin-console, 008-admin-console CHANGES.md GAP-007-01 (3) 확인 |
| ASM-004 | Next.js middleware.ts에서 비관리자 차단 구현 방법(JWT 디코딩, 쿠키 확인, 또는 API 호출)은 HOW 결정사항으로 plan.md에서 확정한다. spec 수준에서는 "비관리자 /admin/* 접근 차단"이라는 WHAT만 정의한다. | 불필요 (plan.md 위임) | plan.md 설계 단계에서 확정 |
| ASM-005 | Playwright E2E(FR-011)는 로컬 `next dev` + backend dev 환경을 전제한다. Docker Compose 통합 E2E 환경은 별도 인프라 구성 작업이며 이번 스펙 범위 외다. | 불필요 | infra.md 로컬 개발 환경 확인 |
