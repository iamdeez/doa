---
작성: Planning Agent
버전: v1.0
최종 수정: 2026-06-30 02:34
상태: 확정 (retroactive)
---

# Selection Phases: 008-console-admin-polish

> 선택 Phase Agent 활성화 여부를 결정한다. 활성화(Y) 시 해당 Agent가 실행된다.
> 본 문서는 구현 완료 코드를 기준으로 retroactive 작성되었다.

## 목차

- [선택 단계 활성화 결정표](#선택-단계-활성화-결정표)
- [결정 근거](#결정-근거)

---

## 선택 단계 활성화 결정표

| 선택 Phase | 활성화 | 이유 |
|---|---|---|
| Database Design Agent | N | DB 스키마 변경 없음. 알림·쿠폰 테이블은 009·010에서 이미 설계. |
| Deploy Agent | N | 배포 구성 변경 없음. 신규 npm 의존 0. 환경변수 변경 없음. |
| Security Agent | N | 신규 외부 연동 없음. 관리자 권한은 백엔드 AdminGuard가 강제. ThemeToggle은 클라이언트 전용. |
| Performance Agent | N | 추가 쿼리·렌더 비용이 기존 007 패턴과 동일. TanStack Query 캐시 활용. |

---

## 결정 근거

- **Database Design Agent(N)**: 알림 테이블(`notifications`)은 009 인앱 알림 백엔드 스펙에서 설계·마이그레이션
  완료. 쿠폰 테이블(`coupons`·`user_coupons`)은 010 쿠폰 할인 스펙에서 설계 완료. 008은 프론트엔드 화면·facade만
  추가하며 DB 스키마 변경 없음.

- **Deploy Agent(N)**: `package.json`·`pnpm-lock.yaml` 변경 없음. 환경변수 추가 없음. Next.js 정적 분석 결과
  라우트 추가(`/admin/coupons`·`/account/notifications`)만 발생하며 배포 절차 변경 없음.

- **Security Agent(N)**: 신규 외부 시스템 연동·인증 메커니즘 변경 없음. 관리자 쿠폰 화면은 백엔드 AdminGuard가
  403을 강제하며, ThemeToggle은 클라이언트 localStorage 작성만 수행한다. 알림 화면은 자신의 알림만 조회하며
  서버에서 인가한다.

- **Performance Agent(N)**: 신규 쿼리(`useQuery['notifications']`·`useQuery[queryScope,'coupons']`)는 기존
  007의 TanStack Query 패턴과 동일한 캐시·invalidate 전략을 따른다. `CouponManager` 추출은 JSX 구조를 이동한
  것으로 렌더링 성능에 영향 없음. `THEME_SCRIPT`는 동기 실행이지만 localStorage 읽기 1회로 최소 비용.
