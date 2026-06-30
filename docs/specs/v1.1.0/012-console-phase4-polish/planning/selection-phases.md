---
작성: Planning Agent
버전: v1.0
최종 수정: 2026-06-30
상태: 확정
---

# selection-phases.md

## 목차

- [선택 단계 활성화 결정](#선택-단계-활성화-결정)
- [신규 의존성 자가 점검 (PATCH-A15)](#신규-의존성-자가-점검-patch-a15)

---

## 선택 단계 활성화 결정

> 활성화 기준: spec.md FR/NFR 에 명시적 요구가 있을 때만 Y. 암묵적 연관 활성화 금지.

- **Database Design Agent**: **N**
  - 근거: DB 스키마 변경·생성 0건. `isAdmin` 은 저장하지 않고 `ADMIN_USER_IDS` env 비교로 도출. `ProductImage`·`Banner`·`FileAsset`·`UserProfile(users)` 전부 기존 테이블. 신규 마이그레이션 불필요(plan.md "데이터 모델").

- **Deploy Agent**: **N**
  - 근거: 배포 환경 구성·컨테이너화·CI/CD 변경 0건. 신규 의존 `@playwright/test` 는 npm devDependency(로컬 E2E 전용)이며 백엔드/console Docker 이미지에 포함되지 않음. console 은 Vercel 자동 배포(기존), 백엔드는 Fly.io(기존) — Dockerfile/docker-compose/fly.toml 무변경. Playwright CI 자동화는 spec 범위 외(로컬 전용·ASM-005). `[env:e2e-docker]` 태그 SC 는 존재하나 실제로는 로컬 stack 실행이며 Docker 빌드에 신규 의존을 주입할 요구 없음 → Deploy 활성 불요.

- **Security Agent**: **N**
  - 근거: 본 spec 은 **새 보안 경계를 도입하지 않는다**. (1) 실제 인가 강제(`AdminGuard`)는 무변경 — middleware 는 NFR-004 가 명시한 **UX 보호 계층**이며 보안 경계가 아니다(plan.md 한계 L2). (2) `GET /auth/me` isAdmin 추가는 **본인의 admin 여부만** 노출(타인 정보·PII·결제 무관). (3) 미러링 쿠키는 클라이언트 신뢰(비-HttpOnly)이며 보안 통제가 아님을 plan·코드에 명시, 최종 방어선은 백엔드 AdminGuard. (4) 인가 관련 문서화는 plan.md "인터페이스 계약 — 인가 3축 표"(PATCH-001/PROC-003)가 최소 방어선으로 대체. → 인증·인가 *변경*이 아닌 *기존 강제의 표면 노출/UX 보강*이므로 Security 단계 비활성. (NFR-004 의 "서버 사이드 차단"은 기존 AdminGuard 가 충족하며, middleware 추가는 UX 계층.)

- **Performance Agent**: **N**
  - 근거: NFR-005(E2E 4 시나리오 ≤2분)는 **애플리케이션 런타임 성능(응답속도·처리량) 목표가 아니라 테스트 스위트 실행 시간 예산**이며, SC-025 가 e2e 러너 리포트로 직접 측정·검증한다. 별도 성능 분석 단계 불요. 그 외 NFR 에 응답속도·처리량 수치 목표 없음.

활성화된 단계 실행 순서: **없음** (4개 선택 단계 모두 비활성).

결정 일시 및 결정자: 2026-06-30, Planning Agent (012-console-phase4-polish).

---

## 신규 의존성 자가 점검 (PATCH-A15)

자가 점검: 본 spec 에 신규 PyPI 의존성 추가가 있는가? (pyproject.toml dependencies 변경)
- **없음** — 본 spec 은 Node.js/TypeScript 프로젝트이며 PyPI 의존성 무관. 신규 의존은 `@playwright/test`(npm devDependency)이고, 이는 PATCH-A15(PyPI 한정) 적용 대상이 아니다.
- npm 생태계 동일 원칙 적용 시: `@playwright/test` 는 로컬 E2E 전용 devDependency 로 Docker 이미지(백엔드 Fly / console Vercel)에 포함되지 않으며, `[env:e2e-docker]` 태그 SC 는 로컬 stack 실행(ASM-005)이고 Docker 빌드 시 설치 요구가 없다 → Deploy Agent 비활성 정당(정적 갈음: SC-020 이 `@playwright/test` devDep + `playwright.config.ts` 존재를 정적 검증).
