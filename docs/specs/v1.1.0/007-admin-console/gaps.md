---
작성: Design Agent → Docs Agent 누적
버전: v1.0
최종 수정: 2026-06-30 02:10
상태: 확정 (retroactive)
---

# Gaps — 007-admin-console

> 기획/설계 공백 누적 기록. 3단계 이후 모든 Agent 가 누적.

## 목차

- [신규 GAP](#신규-gap)
- [해결한 선행 설계 공백](#해결한-선행-설계-공백)

---

## 신규 GAP

### GAP-007-01

- **출처**: Design Agent / Test Agent (research·coverage-gap) / Docs Agent
- **유형**: 프론트 후속·테스트 자동화 한계 + 백엔드 응답 스키마 의존 (Low — 권고) — 배너 삭제 확인·클라이언트
  권한 노출 차단·배너 편집·낙관적 업데이트·e2e 부재 + 응답 스키마 미정의(view 타입 한시)
- **컨텍스트**: `apps/console/app/(dashboard)/admin/banners/page.tsx`(삭제 즉시·편집 미지원·낙관적 미적용)·
  `admin/sellers/page.tsx`·`admin/users/page.tsx`·`admin/stats/page.tsx`·`admin/settlements/page.tsx`·
  `admin/audit-logs/page.tsx`(e2e 부재)·`apps/console/app/(dashboard)/layout.tsx`(admin 네비 권한 필터 부재)·
  `packages/shared-types/src/index.ts`(전이형 view 타입)·백엔드 관리자 라우트(응답 OpenAPI 미정의)
- **내용**:
  - (1) **배너 삭제 확인 다이얼로그 부재** (Low) — 배너 삭제는 `danger` 버튼 클릭 시 `deleteBanner` 를 즉시
    호출하며 파괴적 조치 재확인(`AlertDialog`)이 없다. 실수 삭제 위험이 있으나 배너는 재생성 가능하다.
  - (2) **클라이언트 권한 노출 차단 부재** (Low) — `layout.tsx` 의 `visible` 필터는 seller 섹션만 `isSeller`
    로 가리고 admin 섹션은 항상 노출한다. 비관리자에게도 admin 메뉴가 보인다. 데이터 보호는 백엔드
    `AdminGuard`(403)가 강제하므로 데이터 손상이 아닌 UX 결함이다.
  - (3) **배너 편집(필드 수정) 미지원** (Low) — 화면은 활성 토글 외 제목·이미지·위치·정렬 순서 등 필드 편집
    UI 를 제공하지 않는다. `updateBanner` facade 는 `UpdateBannerRequest`(부분 갱신)를 지원한다.
  - (4) **낙관적 업데이트·e2e 미적용** (Low) — approveSeller·createBanner·updateBanner·deleteBanner mutation
    은 서버 응답 후 invalidate 방식(낙관적 미적용)이며, 관리자 화면 6종에 e2e/단위 테스트가 없다(빌드/타입체크/
    정적 갈음).
  - (5) **응답 스키마 미정의 → view 타입 한시** (Low) — 관리자 통계·정산·사용자·감사·판매자·배너 응답은
    백엔드가 Prisma 엔티티를 반환하고 OpenAPI 응답 content 가 미주석이다(001 GAP-001-01 연속). 따라서 003
    타입드 client 대신 `@doa/shared-types` 전이형 view 타입(금전 string) 9종을 한시 정의했다(004·006 와 동일
    패턴). 정산은 006 `SettlementView` 를 재사용했다.
- **수정 방향**:
  - (1) 배너 삭제 `danger` 버튼에 `AlertDialog`(파괴적 조치 재확인)를 추가한다.
  - (2) `layout.tsx` 에 `useAuth` 의 `isAdmin`(또는 동등 플래그) 기반 admin 섹션 필터를 추가하여 비관리자에게
    admin 메뉴를 가린다(데이터 보호는 백엔드가 강제하므로 UX 보강).
  - (3) 배너 편집 다이얼로그를 추가하여 `updateBanner` 의 부분 갱신을 활성 토글 외 필드까지 노출한다.
  - (4) 각 mutation 에 `onMutate` 낙관적 업데이트 + 롤백을 적용하고, Playwright e2e(통계·정산·사용자 더 보기·
    감사·승인·배너 CRUD)를 추가한다.
  - (5) 백엔드에 관리자 도메인별 응답 DTO + `@ApiResponse({ type })` 를 보강한 후 코드젠 재생성(`openapi:gen`
    → `gen`)하면 view 타입을 생성 타입(`Schemas['...']`)으로 대체 가능하다(006 GAP-006-01 (5) / 004
    GAP-004-01 (3) / 001 GAP-001-01 연속). 금전 필드는 Decimal→문자열이므로 대체 후에도 `string` 유지를
    확인한다(P-005).
- **영향**: 낮음 — Phase 3 핵심 목표(관리자 플랫폼 통계·전체 정산·사용자·감사 로그·판매자 승인·배너 관리 화면)
  는 console typecheck 0·build 22 라우트 PASS 로 달성. (1)~(4)는 후속 UX·테스트 보강이며 핵심 운영 흐름은
  동작한다(권한은 백엔드 강제). (5) view 타입 한시는 점진 보강 대상이다.
- **상태**: OPEN — 전부 Low(후속 위임). (1)~(4) 프론트 후속(배너 삭제 확인·클라이언트 권한 필터·배너 편집·
  낙관적·e2e)은 후속 차수로 이월, (5) 응답 스키마 보강은 001/004/006 GAP 연속(백엔드 후속). coverage-gap.md
  와 동일 사안. 006 GAP-006-01 (Phase 2 프론트 보강)의 관리자 콘솔 연속이며, 007 은 그중 관리자 운영 화면
  6종을 view 타입 + admin facade 로 **구현**한다.

---

## 해결한 선행 설계 공백

| 식별자 | 선행 맥락 | 등급 | 007 해결 | 상태 |
|---|---|---|---|---|
| 관리자 운영 콘솔 부재 (FRONTEND-PLAN Phase 3) | 004·005·006 가 Phase 1~2(판매자 화면)를 완성했으나 console 관리자 운영 화면 부재(`/admin/sellers` 플레이스홀더만 존재) | 후속 위임 | console admin 영역에 플랫폼 통계(`/admin/stats`)·전체 정산(`/admin/settlements`)·사용자(`/admin/users` cursor 무한 스크롤)·감사 로그(`/admin/audit-logs`)·배너 관리(`/admin/banners` CRUD) 5종 추가 + 판매자 승인(`/admin/sellers`) 플레이스홀더를 실데이터+승인 mutation 으로 교체. 응답 OpenAPI 미정의 도메인을 전이형 view 타입 + `api.admin.*` facade 로 호출. AppShell 네비 5개 추가 | **RESOLVED (007, 커밋 e7d8ebb — 관리자 운영 화면 6종 한정. 배너 삭제 확인·클라이언트 권한 필터·배너 편집·낙관적·e2e·응답 스키마 보강은 GAP-007-01 후속)** |
| 판매자 승인 화면 플레이스홀더 | 기존 `/admin/sellers` 가 실데이터 미연동 플레이스홀더 | 후속 위임 | `GET /admin/sellers/pending`(`pendingSellers`) 조회 + `POST /admin/sellers/:id/approve`(`approveSeller` mutation·`onSuccess` invalidate·처리 중 행별 비활성화)로 실데이터화 | **RESOLVED (007, 커밋 e7d8ebb)** |

> 007 은 FRONTEND-PLAN Phase 3(관리자 콘솔)을 구현하되, 006 과 동일하게 응답 스키마가 미정의인 도메인이라
> 타입드 client 대신 view 타입 + facade 를 채택했다(응답 스키마 보강 후 생성 타입 대체 — GAP-007-01 (5)).
> 정산 타입은 006 `SettlementView` 를 재사용하여 중복 정의를 회피했다. admin/coupons 화면(008)·배너 삭제
> 확인·클라이언트 권한 필터·배너 편집·낙관적 업데이트·e2e 는 후속(GAP-007-01)으로 유지된다.
