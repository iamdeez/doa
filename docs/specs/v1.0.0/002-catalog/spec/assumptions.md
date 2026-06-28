---
작성: Spec Agent
버전: v1.0
최종 수정: 2026-06-28
상태: 확정
---

# Assumptions: 002-catalog

> 요구사항 수집 과정에서 명시적으로 정의되지 않아 합리적 기본값·업계 관행으로 처리한 가정 목록

| ID | 가정 내용 | 확인 필요 여부 | 확인 방법 |
|---|---|---|---|
| ASM-001 | 상품 이미지 최대 등록 수는 **10개**로 제한한다. 10개 초과 시 400 반환. | 불필요 (업계 관행 준용) | SC-036으로 검증 |
| ASM-002 | `GET /users/me/product-views` 최근 본 상품은 최신순으로 **최대 50개**까지 반환한다. | 불필요 (합리적 상한) | SC-012로 검증 |
| ASM-003 | 기본 배송지(isDefault=true)를 삭제할 때, 남은 배송지 중 **가장 최근 생성된 것**이 자동으로 기본 배송지로 지정된다. 배송지가 1개인 경우에는 기본 배송지 여부와 무관하게 삭제 가능하다. | 불필요 (UX 관행) | SC-006으로 검증 |
| ASM-004 | OUT_OF_STOCK 상태 상품은 공개 목록 조회(`GET /products`) 및 단건 조회(`GET /products/:id`)에서 **정상 반환**된다. 품절 여부는 응답 상태 필드로 클라이언트가 판단한다. | 불필요 (표준 커머스 UX) | SC-038, SC-039로 검증 |
| ASM-005 | 이번 spec에서 seller 승인(`PATCH /sellers/:id/approve`)·거부(`PATCH /sellers/:id/reject`) API는 **JWT 인증만 요구**한다. admin role 기반 접근 제어는 후속 admin 모듈 구현 시 추가된다. | 후속 spec에서 구현 확인 | admin 모듈 spec에서 RBAC 추가 시 기존 엔드포인트 Guard 확장 |
| ASM-006 | 배송지(addresses) 테이블의 주요 필드는 다음과 같다: `recipientName`, `phone`, `zipCode`, `address1`, `address2(선택)`, `isDefault`. 추가 필드(예: 배송 메모)는 후속 spec에서 추가한다. | 불필요 (명세 충분) | Prisma schema 작성 시 확인 |
| ASM-007 | 판매자(sellers) 테이블의 주요 필드는 다음과 같다: `businessName`, `businessNumber`, `representativeName`, `contactPhone`, `businessAddress`, `status(PENDING/APPROVED/REJECTED)`, `rejectReason(nullable)`. 정산 계좌 정보는 settlement 모듈(Stage 3 이후)에서 별도 관리한다. | 불필요 (명세 충분) | Prisma schema 작성 시 확인 |
