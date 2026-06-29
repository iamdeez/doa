---
작성: Spec Agent
버전: v1.0
최종 수정: 2026-06-29
상태: 확정
---

# Spec Input: 004-review-coupon
> 수집 일시: 2026-06-29 | 사용자 최종 확인: 완료

## 수집 진행 상태

| 카테고리 | 상태 | 마지막 질문 번호 | 답변 완료 항목 |
|---|---|---|---|
| 1. 배경 및 목적 | 완료 | Q3 | [Q1, Q2, Q3] |
| 2. 사용자 & 이해관계자 | 완료 | Q6 | [Q4, Q5, Q6] |
| 3. 핵심 기능 | 완료 | Q-A~J | [Q-A, Q-B, Q-C, Q-D, Q-E, Q-F, Q-G, Q-J] |
| 4. 데이터 & 입출력 | 완료 | Q-H, Q-I | [Q-H, Q-I] |
| 5. 제약조건 | 완료 | Q13~Q16 | [Q13, Q14, Q15, Q16] |
| 6. 운영 환경 | 완료 | Q17~Q19 | [Q17, Q18, Q19] |
| 7. 예외 & 실패 시나리오 | 완료 | Q20~Q22 | [Q20, Q21, Q22] |

## 질문 분석 근거 (Question Analysis Basis)

| 질문 ID | 요지 | 옵션별 근거·trade-off | 추천안(이유) | 채택 결과 |
|---|---|---|---|---|
| Q-A | 쿠폰 할인 유형 | A:정액+정률 / B:정액+정률+배송비 / C:정액만 | A (shipping 미구현) | **A 채택** |
| Q-B | 쿠폰 발급 주체 | A:관리자만 / B:관리자+APPROVED 판매자 | B (오픈마켓 표준) | **B 채택** |
| Q-C | 쿠폰 사용 방식 | A:공용코드 / B:user_coupons 개인발급 / C:혼합 | B (context.md 설계 방향) | **B 채택** |
| Q-D | 1주문 쿠폰 중복 | A:1주문 1쿠폰 / B:복수 허용 | A (단순) | **A 채택** |
| Q-E | 리뷰 평점 범위 | A:1~5점 / B:1~10점 | A (가장 일반적) | **A 채택** |
| Q-F | 리뷰 이미지 | A:없음 / B:URL첨부 / C:파일업로드 | A (file 모듈 미구현) | **A 채택 (텍스트+평점만)** |
| Q-G | 리뷰 수정·삭제 | A:모두허용 / B:수정만 / C:불허 | A | **A 채택 (본인만, PATCH-001)** |
| Q-H | 쿠폰 조건 | 최소주문금액+최대할인상한 지원 | A | **A 채택 (둘 다 지원)** |
| Q-I | 쿠폰 만료 | A:만료일 필수 / B:선택 | A | **A 채택 (expiresAt 필수)** |
| Q-J | 리뷰 단위 | A:OrderItem 단위 / B:Order 단위 | A (1주문 다상품 지원) | **A 채택 (orderItemId 기준)** |

## 카테고리별 수집 내용

### [카테고리 1] 배경 및 목적

Q1. 이 기능을 왜 만드는가?
- 쿠폰: 마케팅 도구로서 고객 구매 유도·재방문 촉진. 003-commerce에서 `discountAmount=0` 고정으로 남겨둔 쿠폰 연동 공백을 채운다. SEC-FIND-004 재발 방지: 클라이언트가 할인금액을 임의 지정하는 경로를 허용하지 않고, 서버가 쿠폰 검증 후 계산.
- 리뷰: 구매 신뢰 지표로서 상품에 대한 실구매자의 평점·의견을 수집. 오픈마켓의 핵심 도메인 기능.

Q2. 현재 어떻게 해결하고 있는가?
- 쿠폰: 미구현. 003-commerce OrderService.createOrder에서 discountAmount=new Prisma.Decimal(0) 고정.
- 리뷰: 미구현. commerce 스키마에 reviews 테이블 미생성(네임스페이스 선언만).

Q3. 성공 판단 기준
- 고객이 보유 쿠폰(user_coupon)을 주문 시 적용하면 서버가 할인 금액을 계산하여 order.discountAmount가 설정된다.
- 구매 완료(completed) 주문의 orderItem에 대해 1건의 리뷰를 작성할 수 있다.
- 타인의 쿠폰 사용·타인의 리뷰 수정·삭제 등 IDOR가 차단된다(PATCH-001).

### [카테고리 2] 사용자 & 이해관계자

Q4. 사용자 역할
- 관리자(AdminGuard): 전체몰 쿠폰 생성·발급
- APPROVED 판매자: 판매자 범위 쿠폰 생성·발급(본인 sellerId 범위)
- 인증된 고객: 보유 쿠폰 조회, 주문 시 쿠폰 적용, 리뷰 CRUD
- 비인증 방문자: 상품 리뷰 목록 공개 조회

Q5. 기술 수준
- 판매자·관리자: 대시보드 수준. 고객: Flutter 앱 수준.

Q6. 이해관계자
- 판매자: 자신이 발급한 쿠폰의 할인 비용 발생. 상품 리뷰는 판매자 신뢰와 직결.
- stats 모듈: coupon.used·review.created 이벤트 소비 대상(후속 구현).

### [카테고리 3] 핵심 기능

**쿠폰 Must:**
- 쿠폰 생성(관리자/판매자), 고객에게 user_coupon 발급, 보유 쿠폰 조회
- 주문 생성 시 userCouponId 수신 → 서버 할인 계산 → discountAmount 설정
- 쿠폰 유효성 검증(만료·사용여부·소유권·최소주문금액)
- 이중사용 방지(조건부 UPDATE WHERE status='unused')
- 주문 취소 시 쿠폰 복원(user_coupon.status=unused)
- 결제 금액 = totalAmount - discountAmount

**리뷰 Must:**
- completed 주문의 orderItem 대해서만 작성 가능 (orderItemId당 1건, 본인만)
- 리뷰 수정·삭제(본인만)
- 상품 리뷰 목록 공개 조회 (cursor 페이지네이션)
- 내 리뷰 목록 조회

**제외(명시적 Out of Scope):**
- 배송비 쿠폰(shipping 미구현), 공용 코드 방식, 복수 쿠폰 중복 사용
- 리뷰 이미지 첨부(file 모듈 미구현), 판매자 리뷰 답글, 리뷰 신고

### [카테고리 4] 데이터 & 입출력

**쿠폰 데이터:**
- coupon: issuerType(ADMIN|SELLER), issuerId(String), type(FIXED|PERCENTAGE), discountValue(Decimal), maxDiscountAmount(Decimal? — 정률 전용), minOrderAmount(Decimal?), expiresAt(DateTime 필수), totalQuantity(Int? nullable=무제한), description(String?)
- user_coupon: couponId, userId(String), status(unused|used|expired), usedOrderId(String?)

**리뷰 데이터:**
- review: orderItemId(unique 기준), orderId, userId, productId, sellerId, rating(1~5), content(String), createdAt, updatedAt

**금전 필드:** discountValue, maxDiscountAmount, minOrderAmount, order.discountAmount → Decimal(P-005)

**연동:**
- 주문 생성: CreateOrderDto에 optional userCouponId 추가. OrderService가 CouponService 호출(DI).
- 리뷰 작성: ReviewService가 OrderService 또는 OrderRepository 호출(DI)로 orderItem→order 조회(P-001 준수).
- 결제: PaymentService가 order.totalAmount - order.discountAmount를 청구 금액으로 사용.

### [카테고리 5] 제약조건

Q13. 기술 스택 제약
- P-001: commerce Repository는 commerce 스키마(coupons·user_coupons·reviews)에만 직접 접근
- P-005: 금전 필드 Decimal, 부동소수점 금지. PERCENTAGE 할인 계산 시 FLOOR(내림) 적용.
- P-002/P-004: AWS 전용 SDK 신규 의존 없음

Q14. 일정 제약: 없음(003-commerce 완료 직후 Stage 3)

Q15. 성능: 특별한 P95 수치 제약 없음. 리뷰 목록 cursor 페이지네이션 적용.

Q16. 보안
- SEC-FIND-004 재발 방지: 클라이언트 discountAmount 직접 지정 불가
- IDOR 차단: user_coupon.userId 검증, review.userId 검증 (PATCH-001)
- 이중사용 방지: 조건부 UPDATE(WHERE status='unused')

### [카테고리 6] 운영 환경

Q17-19: 003-commerce와 동일(로컬 docker-compose + Fly.io). 순수 로직 추가, 인프라 특이성 cross-reference 불필요.

### [카테고리 7] 예외 & 실패 시나리오

Q20. 실패 시 동작
- 쿠폰 적용 주문 생성 실패 → 트랜잭션 롤백 → user_coupon.status=unused 유지
- 주문 취소 + 쿠폰 복원 실패 → 트랜잭션 롤백 → 취소 미처리

Q21. 엣지 케이스
- 쿠폰 이중사용 동시 요청: 조건부 UPDATE로 1건 성공·나머지 409
- discountAmount > totalAmount: MIN(discountValue, totalAmount) 적용(음수 방지)
- PERCENTAGE + maxDiscountAmount 없음: 상한 없이 계산
- completed 아닌 주문 리뷰 시도: 422
- 동일 orderItemId 중복 리뷰: 409

Q22. 백업·복구: 단일 PostgreSQL 트랜잭션 원자성으로 보장. 003-commerce 패턴 동일.

## 보완 내용

**coupon↔order 연동 핵심 (SEC-FIND-004 재발 방지):**
- POST /orders에 optional userCouponId 추가.
- 서버가 쿠폰 유효성 검증 후 discountAmount 계산·설정. 클라이언트 금액 지정 불가.
- 쿠폰 사용: 주문 생성 트랜잭션 내 user_coupon.status=used (WHERE status='unused' 조건부).
- 결제: payment.amount = order.totalAmount - order.discountAmount.
- 주문 취소: user_coupon.status=unused 복원 (취소 트랜잭션 내).

**review↔order 연동:**
- orderItemId → OrderItem → Order 조회 → userId(본인)·status(completed) 검증.
- orderItemId 기준 UNIQUE 제약으로 1리뷰 보장.

**PATCH-001 사전 평가 결과:**
- 판매자 자신의 상품에 리뷰 작성: 허용하되 위험 명시. 향후 별도 제어 정책 spec.
- 모든 상태 부여 엔드포인트(쿠폰 발급·사용, 리뷰 작성)에 소유권 검증 적용.
