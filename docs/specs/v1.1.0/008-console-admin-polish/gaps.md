---
작성: Docs Agent
버전: v1.0
최종 수정: 2026-06-30 02:34
상태: 확정 (retroactive)
---

# Gaps — 008-console-admin-polish

> 008 구현 중 식별된 기획/설계 공백·기술 부채를 기록한다.
> 출처: Docs Agent / Test Agent (EXECUTION). 형식: `GAP-{SPEC번호}-{순번}`.

## 목차

- [GAP 목록](#gap-목록)
- [GAP-008-01 상세](#gap-008-01-상세)

---

## GAP 목록

| GAP-ID | 유형 | 상태 | 요약 |
|---|---|---|---|
| GAP-008-01 | 기술 부채 | OPEN | e2e 테스트 부재 + 알림·admin 쿠폰 응답 OpenAPI 미정의(view 타입 한시) |

---

## GAP-008-01 상세

**유형**: 기술 부채 (004·006·007 GAP 연속)

**상태**: OPEN

**출처**: Docs Agent / Test Agent (EXECUTION)

**요약**: e2e 테스트 부재 + 알림·admin 쿠폰 응답 OpenAPI 미정의(전이형 view 타입 한시)

**내용**:

1. **e2e/단위 테스트 부재**: 본 차수는 UI 화면 위주로 별도 단위/e2e 테스트 스위트를 추가하지 않았다.
   검증은 `console typecheck 0 + console build 라우트 PASS + 정적 구조 검증`으로 갈음한다(007 연속).
   다음 동작은 현재 검증 방식으로 완전히 검증할 수 없다:
   - 다크모드 전환 시 FOUC 없음 (브라우저 렌더링 동작)
   - localStorage 불가 환경(시크릿 모드)에서 try-catch 동작
   - 알림 0건·전체 읽음 후 EmptyState/헤더 버튼 미노출
   - markRead·markAllRead 후 목록 재조회 invalidate 동작
   - 관리자 쿠폰 화면 실 데이터 연동

2. **알림·admin 쿠폰 응답 OpenAPI 미정의**: `GET /notifications`·`GET /admin/coupons`·`POST /admin/coupons`·
   `POST /admin/coupons/:id/issue` 백엔드 응답의 OpenAPI `@ApiResponse({ type })` 주석 미적용으로 인해
   전이형 view 타입(`NotificationType`·`Notification`·`NotificationListResult` — `shared-types`)을 한시 정의했다.
   백엔드 응답 DTO + `@ApiResponse({ type })` 보강 후 생성 타입으로 대체 가능하다(001 GAP-001-01·004
   GAP-004-01·006 GAP-006-01·007 GAP-007-01 연속).

3. **다크모드 관련 미구현 항목**:
   - 시스템 다크모드 변경 실시간 감지(`matchMedia` 이벤트) — 범위 외(후속)
   - `prefers-color-scheme` 변경 시 자동 전환 — 범위 외(후속)

4. **알림 화면 미구현 항목**:
   - 실시간 push(WebSocket/SSE) — 범위 외(후속)
   - 알림 삭제 — 범위 외(후속)
   - 낙관적 업데이트 — 범위 외(후속)

5. **CouponManager 미구현 항목**:
   - cursor 더보기(무한 스크롤 또는 페이지네이션) — 범위 외(후속)
   - 쿠폰 수정 — 범위 외(후속)

**영향 범위**:
- `apps/console/app/(dashboard)/account/notifications/page.tsx`
- `apps/console/app/(dashboard)/admin/coupons/page.tsx`
- `apps/console/components/coupon-manager.tsx`
- `packages/shared-types/src/index.ts` (notification view 타입)

**후속 계획**:
- e2e 테스트: 전용 e2e 스펙 spec(Playwright 등)으로 분리 후 추가
- OpenAPI 응답 미정의: 백엔드 팀과 협의하여 DTO + `@ApiResponse({ type })` 보강 후 생성 타입 대체
- 실시간 알림·cursor 더보기: 별도 후속 스펙으로 분리

**관련 GAP**: GAP-007-01 (007 admin view 타입 한시 + e2e 부재), GAP-006-01, GAP-004-01, GAP-001-01
