---
작성: Spec Agent
버전: v1.0
최종 수정: 2026-06-29 18:15
상태: 확정 (retroactive)
---

# Spec Input: 007-banner-stats-admin
> 수집 일시: 2026-06-29 | 맥락: 경량 모드 백엔드 진행 → 정식 SDD 문서화

## 수집 진행 상태

| 카테고리 | 상태 | 답변 완료 항목 |
|---|---|---|
| 1. 배경 및 목적 | 완료 | [Q1, Q2, Q3] |
| 2. 사용자 & 이해관계자 | 완료 | [Q4, Q5] |
| 3. 핵심 기능 | 완료 | [Q-A~F] |
| 4. 데이터 & 입출력 | 완료 | [Q-G, Q-H] |
| 5. 제약조건 | 완료 | [Q6, Q7] |
| 6. 예외 & 실패 시나리오 | 완료 | [Q8, Q9] |

## 원 요청 맥락

사용자 지시: **"경량 모드로 나머지 백엔드 진행"** — 003~006 완료 후, 마지막 운영 측 백엔드 도메인
묶음(배너·통계·운영관리)을 경량 모드(spec.md 1장으로 요구사항·수용 기준·구현 결과 통합)로 구현했다.
007 은 banner·stats·admin 3개 도메인을 하나의 spec 으로 묶었다. 본 문서는 그 경량 산출물을 정식 SDD
포맷으로 보강하기 위한 입력 재구성이다.

## 질문 분석 근거 (Question Analysis Basis)

| 질문 ID | 요지 | 옵션·근거 | 채택 결과 |
|---|---|---|---|
| Q-A | 배너 데이터 소유 | A:admin 스키마 banners 단독 소유 / B:기존 스키마 합류 | **A 채택**(신규 admin 스키마 banners) |
| Q-B | 배너 노출기간 필터 위치 | A:DB where 절 / B:애플리케이션 레벨(isWithinPeriod) | **B 채택**(listActiveOrdered 후 in-memory, 후속 푸시다운 — GAP-007-02) |
| Q-C | stats 데이터 소유 | A:집계 캐시 테이블 / B:도메인 Service DI 조합(자체 테이블 없음) | **B 채택**(P-001, StatsRepository 빈 클래스) |
| Q-D | admin 데이터 소유 | A:admin 자체 테이블 / B:도메인 Service DI 조합(자체 테이블 없음) | **B 채택**(P-001, AdminRepository 빈 클래스) |
| Q-E | 판매자 승인 구현 | A:admin 모듈 신규 구현 / B:기존 SellerService.approve 재사용 | **B 채택**(재사용, 병렬 라우트 — OBS-007-01) |
| Q-F | 매출 집계 타입 | Prisma.Decimal | **채택**(P-005, 부동소수점 금지) |
| Q-G | admin 사용자 목록 페이지네이션 | A:offset / B:cursor(민감 필드 제외) | **B 채택**(cursor, password 제외 안전 요약) |
| Q-H | 관리자 액션 audit log | 도입 여부 | **미도입**(후속 — GAP-007-01) |

## 카테고리별 수집 내용

### [카테고리 1] 배경 및 목적

Q1. 왜 만드는가?
- 메인 노출 배너를 운영(생성·수정·삭제·노출기간 제어)하는 경로 부재.
- 관리자·판매자가 플랫폼/본인 매출 요약을 조회하는 통계 경로 부재.
- 승인 대기 판매자 조회·승인, 사용자 목록 조회 등 운영 조치 진입점 부재.

Q2. 현재 어떻게?
- 미구현. banner·stats·admin 모듈은 빈 스텁(골격만). 판매자 승인은 seller 도메인에만 존재
  (`PATCH /sellers/:id/approve`).

Q3. 성공 판단 기준
- `GET /banners` 가 활성·노출기간 내 배너만 정렬순으로 반환한다.
- `GET /admin/stats/overview` 가 주문·매출(Decimal)·사용자·판매자 요약을 반환한다.
- 관리자가 승인 대기 판매자를 조회·승인하고 사용자 목록을 페이지 단위로 받는다.

### [카테고리 2] 사용자 & 이해관계자

Q4. 사용자 역할
- 관리자(AdminGuard): 배너 CRUD, 플랫폼 통계, 판매자 승인, 사용자 목록.
- 구매자(비인증 포함): 공개 배너 조회.
- APPROVED 판매자: 본인 매출 통계.

Q5. 이해관계자
- 프런트엔드: 메인 배너 슬롯·관리자 대시보드·판매자 대시보드 직접 소비자.
- 운영팀: 판매자 승인·사용자 조회 운영 도구 사용자.

### [카테고리 3] 핵심 기능

**배너 Must:**
- 관리자 CRUD(create 201·update PATCH·delete 204·listAll), 공개 조회(활성·노출기간·sortOrder).

**통계 Must:**
- overview(총 주문·완료 주문·총 매출 Decimal·총 사용자·총 판매자), seller stats(본인 completed 매출
  Decimal·건수).

**운영관리 Must:**
- listPendingSellers, approveSeller(SellerService.approve 재사용), listUsers(cursor·민감 필드 제외).

**제외(Out of Scope):**
- 관리자 audit log, 배너 노출기간 DB 푸시다운, 승인 라우트 일원화, 배너 클릭/노출 집계, 통계 시계열.

### [카테고리 4] 데이터 & 입출력

**배너 데이터(admin 스키마 — 신규):**
- banners: title, imageUrl, linkUrl?(null=비링크), position(BannerPosition default MAIN_TOP),
  sortOrder(default 0), isActive(default true), startsAt?, endsAt?, createdAt. index(isActive,
  position, sortOrder). 금전 필드 없음.

**통계(소유 테이블 없음):**
- OrderService(countAllOrders·countCompletedOrders·sumCompletedSales·getSellerSalesSummary),
  UserService(countAllUsers), SellerService(countAllSellers) DI 조합. 매출 Prisma.Decimal.

**운영관리(소유 테이블 없음):**
- SellerService(listByStatus·approve), UserService(listUsersForAdmin) DI 조합.

### [카테고리 5] 제약조건

Q6. 기술 스택 제약
- P-001: banner Repository 는 admin.banners 만. stats·admin 자체 테이블 없음(도메인 Service DI). additive
  메서드는 자기 스키마 내 집계. cross-schema plain String.
- P-002: 신규 npm 의존 0. AWS SDK 0.
- P-005: 매출 집계 Prisma.Decimal(부동소수점 금지). banner 는 금전 필드 없음.

Q7. 성능: 특별한 P95 수치 제약 없음. 배너·통계 조회는 인덱스(banner) + 도메인 집계로 충족.

### [카테고리 6] 예외 & 실패 시나리오

Q8. 실패 시 동작
- 토큰 없는 관리자/판매자 요청 → 401. 비관리자 관리자 요청 → 403. 미존재 배너 수정/삭제 → 404.
- 미승인 판매자 통계 → 403(ForbiddenException).

Q9. 엣지 케이스
- 배너 노출기간 경계값(startsAt==now·endsAt==now) → 노출. 시작 전·종료 후 → 숨김.
- admin listUsers limit 초과 → 100 클램프, 1 미만 → 1.
- 판매자 승인 병렬 라우트(OBS-007-01, 허용·기록).
- 관리자 audit log 미도입(GAP-007-01). 배너 노출 필터 in-memory(GAP-007-02).
