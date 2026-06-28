---
작성: Spec Agent
버전: v1.0
최종 수정: 2026-06-28
상태: 확정
---

# Spec Input: 002-catalog

> 수집 일시: 2026-06-28 [시각 미확인] | 사용자 최종 확인: spec.md 검토 대기

## 수집 진행 상태

| 카테고리 | 상태 | 마지막 질문 번호 | 답변 완료 항목 |
|---|---|---|---|
| 0. 범위 합의 (사전) | 완료 | Q0 | [Q0] |
| 1. 배경 및 목적 | 완료 | Q3 | [Q1, Q2, Q3] |
| 2. 사용자 & 이해관계자 | 완료 | Q6 | [Q4, Q5, Q6] |
| 3. 핵심 기능 | 완료 | Q9 | [Q7-a, Q7-b, Q7-c, Q8, Q9] |
| 4. 데이터 & 입출력 | 완료 | Q12 | [Q10-a, Q10-b, Q10-c, Q11, Q12] |
| 5. 제약조건 | 완료 | Q16 | [Q13, Q14, Q15-a, Q16] |
| 6. 운영 환경 | 완료 | Q19 | [Q17, Q18, Q19] |
| 7. 예외 & 실패 시나리오 | 완료 | Q22 | [Q20, Q21, Q22] |

## 질문 분석 근거 (Question Analysis Basis)

| 질문 ID | 요지 | 옵션별 근거·trade-off | 추천안(이유) | 채택 결과 |
|---|---|---|---|---|
| Q0 | 002 spec 범위: 7개 도메인 전체 vs 분할 | A: 전체 7개(FR 50~70개, 복잡도 최대) / B: 2분할 카탈로그+거래(각 FR 25~35개) / C: 3분할(오버헤드 높음) | B | **옵션 B 채택** — 002=카탈로그(user·seller·product·inventory), 003=거래(cart·order·payment) |
| Q7-a | seller 심사 워크플로우 | A: 자동 승인(즉시 APPROVED) / B: 수동 심사(PENDING→APPROVED/REJECTED, admin 결정) | B | **수동 심사 채택** — PENDING→APPROVED/REJECTED, REJECTED 사유 필드 포함 |
| Q7-b | 상품 상태 머신 | A: 2상태(ACTIVE/INACTIVE) / B: 4상태(DRAFT→ACTIVE→OUT_OF_STOCK→INACTIVE) | B | **4상태 채택** |
| Q7-c | 재고 차감 인터페이스 (003 연계) | A: DI 직접 호출(동일 트랜잭션, P-001 허용) / B: 이벤트 방식(느슨한 결합) | A | **DI 직접 호출 채택** — InventoryService 공개 메서드 명세 |
| Q10-a | user 프로필 추가 필드 | A: 최소(name, phone) / B: 중간(+birthDate) / C: 최대(+birthDate/gender/avatarUrl) | A | **최소 채택** — name, phone |
| Q10-b | product 이미지 처리 | A: URL 직접 입력(이번 범위) / B: 업로드 API 포함(file 모듈 선구현) | A | **URL 직접 입력 채택** |
| Q10-c | 페이지네이션 방식 | A: Offset/Limit / B: Cursor 기반(무한스크롤) | B | **Cursor 기반 채택** — after={cursor}&limit=N |
| Q15-a | 성능 SLA 수치 | A: 200ms 이하 / B: 500ms 이하(추천) / C: 1,000ms 이하 | B | **P95 500ms 이하** (로컬/dev 기준) |

## 카테고리별 수집 내용

### [사전] 범위 합의

**Q0 — 채택 결과: 옵션 B (2분할)**
- **002-catalog 범위**: user · seller · product · inventory (4개 도메인 — 본 spec)
- **003 범위**: cart · order · payment (다음 spec — 이번 Out of Scope)
- **spec-name**: `002-catalog` (002-core-commerce → 002-catalog, main session 폴더 rename 처리)
- **추가 범위 합의**:
  - user: 프로필(name·phone), 배송지(addresses), 찜(wishlist), 최근 본 상품(product_views)
  - seller: 등록·심사 상태·판매자 정보
  - product: 상품·카테고리·옵션·variant·이미지URL·4상태
  - inventory: 재고·입출고로그·공개 차감/조회 인터페이스 명세

### [카테고리 1] 배경 및 목적

**Q1 — 이 시스템/기능을 왜 만드는가?**
AWS 기반 MSA(18개 서비스, 월 수백 달러 고정비)를 Fly.io 모듈러 모놀리스로 재구축하는 Stage 2 카탈로그 단계. user·seller·product·inventory 4개 모듈의 빈 스텁을 실구현으로 채워, 003(거래: cart/order/payment) spec의 전제조건을 완성한다. (출처: REBUILD-PLAN §1·§12)

**Q2 — 현재 방식과 한계**
기존: AWS ECS Fargate 16~18개 컨테이너 + RDS 7개 + DynamoDB 8개 테이블. 한계: 서비스 간 HTTP 통신·분산 트랜잭션 복잡도, 상시 고정비 수백 달러/월, AWS 종속. (출처: REBUILD-PLAN §2)

**Q3 — 성공 판단 기준**
1. 003 spec 착수 시 product 재고 조회 API, seller 정보 API, user 프로필 API가 정상 동작
2. 4개 모듈 스텁 모두 실구현 교체, 테스트 통과
3. Prisma 스키마(users, products 스키마) 목표 테이블 실체화 완료

### [카테고리 2] 사용자 & 이해관계자

**Q4 — 시스템 사용자**
1. 구매자(user) — Flutter 고객 앱에서 프로필 관리·배송지·찜·상품 조회
2. 판매자(seller) — 콘솔 웹(apps/console)에서 상품 등록·관리·재고 관리
3. 관리자(admin) — 콘솔 웹에서 seller 심사·승인, 카테고리 관리

**Q5 — 사용자 기술 수준**
구매자(일반 소비자, 모바일 친숙), 판매자(중간 기술, 웹 대시보드 사용), 관리자(내부 운영팀)

**Q6 — 이해관계자**
003(거래) 개발팀(product/inventory API 소비자), Fly.io 배포·운영팀

### [카테고리 3] 핵심 기능

**Q7-a — seller 심사 워크플로우 (확정: 수동 심사)**
- 등록 신청 → PENDING → APPROVED / REJECTED(+ rejectReason)
- PENDING/REJECTED 판매자는 상품 등록 불가 (403)
- 승인/거부 API 포함 (이번 spec). admin 심사 UI는 후속 admin 모듈 (Out of Scope).
- API 호출 권한: 이번 spec에서 JWT 인증만 요구, admin role 검증은 후속 추가 (ASM-005)

**Q7-b — 상품 상태 머신 (확정: 4상태)**
```
DRAFT --[판매자 게시]--> ACTIVE --[재고 0 자동]--> OUT_OF_STOCK
ACTIVE/OUT_OF_STOCK --[판매자 종료]--> INACTIVE
OUT_OF_STOCK --[재고 복구 자동]--> ACTIVE
INACTIVE --[판매자 재게시]--> ACTIVE
```
공개 목록: ACTIVE + OUT_OF_STOCK 노출. DRAFT/INACTIVE 비노출.

**Q7-c — 재고 차감 인터페이스 (확정: DI 직접 호출)**
- `InventoryService.checkAvailability(variantId, quantity)`: 재고 가용 여부 확인
- `InventoryService.decreaseStock(variantId, quantity, orderId)`: 재고 차감
- constitution P-001(모듈 간 공개 서비스 인터페이스 허용) 준수

**Q8 — Should Have**
찜 목록(wishlist) 추가/삭제/조회, 최근 본 상품(product_views) 기록/조회, 상품 조회수 트래킹

**Q9 — Out of Scope**
cart·order·payment(003), coupon·review·search·notification·file·banner·stats·admin(Stage 3 이후), 파일 업로드 API, admin 심사 UI, 결제·정산

### [카테고리 4] 데이터 & 입출력

**Q10-a — user 프로필 추가 필드 (확정: 최소)**
name(이름), phone(연락처) — 기존 User(id/email/password) 확장

**Q10-b — product 이미지 처리 (확정: URL 직접 입력)**
product_images 테이블에 url, displayOrder 저장. 업로드 API는 Stage 3 file 모듈.

**Q10-c — 페이지네이션 (확정: Cursor 기반)**
after={cursor}&limit=N (cursor = product.id 기반)

**Q11 — 외부 시스템 연동**
auth 모듈(shared) 연계: User 엔티티 공유(users 스키마 내). Cloudflare R2: 이번 미사용.

**Q12 — 데이터 민감도**
개인정보: name, phone, addresses. 판매자: businessNumber. password 필드 응답 제외 필수.

### [카테고리 5] 제약조건

**Q13 — 기술 스택**: NestJS, Prisma, PostgreSQL 16, TypeScript (확정)

**Q14 — 일정**: Stage 2 로드맵, 구체적 마감일 미정. 003 착수 전 완료 목표.

**Q15-a — 성능 SLA**: 상품 목록 조회 P95 500ms 이하 (로컬 docker-compose, 상품 < 1,000개)

**Q16 — 보안**: JWT 인증 필수(비인증 허용 endpoint 명시 제외), 판매자 본인 데이터 접근만 허용, 개인정보 필드 응답 최소화

### [카테고리 6] 운영 환경

**Q17 — 환경**: 로컬 docker-compose + CI(GitHub Actions) + Fly.io 목표

**Q18 — 규모**: 재구축 단계, 개발·테스트 규모

**Q19 — 담당**: 개발팀 + AI 파이프라인, Fly.io 자동 배포

**배포 환경 cross-reference 결과**: 순수 비즈니스 로직 구현 spec, 네트워크 레이어 특이성 영향 없음

### [카테고리 7] 예외 & 실패 시나리오

**Q20 — 시스템 실패**: DB 연결 실패→503, Prisma 에러→500(상세 외부 노출 금지), 비즈니스 예외→4xx

**Q21 — 예외 케이스**
- PENDING/REJECTED 판매자 상품 등록 → 403
- 존재하지 않는 카테고리 상품 등록 → 400
- OUT_OF_STOCK 상품 조회 → 정상 반환(품절 상태)
- 재고 부족 시 decreaseStock → InsufficientStockException
- 타인 상품/배송지 수정 → 403
- 찜 중복 → 409, 판매자 중복 등록 → 409

**Q22 — 백업/복구**: Fly Postgres 자동 백업 (인프라 레벨, spec 범위 외)

## 보완 내용

- ASM-001: 상품 이미지 최대 10개 (미명시 → 합리적 기본값)
- ASM-002: 최근 본 상품 최대 50개 반환 (미명시 → 기본값)
- ASM-003: 기본 배송지 삭제 시 나머지 배송지 중 최근 생성순으로 자동 기본 지정
- ASM-004: OUT_OF_STOCK 상품은 공개 목록/단건 조회 가능 (구매 불가, 품절 표시)
- ASM-005: seller 승인/거부 API는 이번 spec에서 JWT 인증만 요구. admin role 검증은 후속 admin 모듈 추가.
- ASM-006: 주소 필드 — recipientName, phone, zipCode, address1, address2, isDefault
- ASM-007: 판매자 프로필 필드 — businessName, businessNumber, representativeName, contactPhone, businessAddress
