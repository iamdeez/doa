---
작성: Test Agent (EXECUTION)
버전: v1.1
최종 수정: 2026-06-28 19:10
상태: 확정
비고: SEC-001 수정 후 재검증. 테스트 총수 98 → 101 (admin.guard.spec.ts +3). SC-001~051 커버리지 변동 없음
---

# Coverage: 002-catalog

## 목차

- [SC × 시나리오 커버리지 매트릭스](#sc--시나리오-커버리지-매트릭스)
  - [user 모듈 (SC-001~012)](#user-모듈-sc-001012)
  - [seller 모듈 (SC-013~018)](#seller-모듈-sc-013018)
  - [product 모듈 (SC-019~040)](#product-모듈-sc-019040)
  - [inventory 모듈 (SC-041~046)](#inventory-모듈-sc-041046)
  - [비기능 요구사항 (SC-047~051)](#비기능-요구사항-sc-047051)
- [커버리지 요약](#커버리지-요약)
- [STALE_SC 경고](#stale_sc-경고)

---

## SC × 시나리오 커버리지 매트릭스

### user 모듈 (SC-001~012)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | plan.md 시나리오 전체 | 상태 |
|---|---|---|---|---|---|---|
| SC-001 | GET /users/me password 제외 프로필 반환 | PASS | — | — | PASS | PASS |
| SC-002 | 비인증 GET /users/me 401 | — | — | PASS | PASS | PASS |
| SC-003 | PATCH /users/me DB 반영 | PASS | — | — | PASS | PASS |
| SC-004 | POST addresses 201 생성 | PASS | — | — | PASS | PASS |
| SC-005 | 본인 주소 수정 OK / 타인 403 | PASS | — | PASS | PASS | PASS |
| SC-006 | 기본배송지 삭제 → 최근 생성 자동 재지정 | — | PASS | — | PASS | PASS |
| SC-007 | 기본배송지 지정 → 이전 기본 해제 | PASS | — | — | PASS | PASS |
| SC-008 | 찜 추가 / 중복 409 | PASS | — | PASS | PASS | PASS |
| SC-009 | 찜 제거 204 | PASS | — | — | PASS | PASS |
| SC-010 | 찜 목록 반환 | PASS | — | — | PASS | PASS |
| SC-011 | product.viewed → product_views upsert | PASS | — | — | PASS | PASS |
| SC-012 | 최근본상품 최신순 50 상한 | — | PASS | — | PASS | PASS |

### seller 모듈 (SC-013~018)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | plan.md 시나리오 전체 | 상태 |
|---|---|---|---|---|---|---|
| SC-013 | 판매자 등록 PENDING / 중복 409 | PASS | — | PASS | PASS | PASS |
| SC-014 | GET /sellers/me 프로필 반환 | PASS | — | — | PASS | PASS |
| SC-015 | PATCH /sellers/me 수정 DB 반영 | PASS | — | — | PASS | PASS |
| SC-016 | GET /sellers/me/status {status,rejectReason} | PASS | — | — | PASS | PASS |
| SC-017 | approve → APPROVED | PASS | — | — | PASS | PASS |
| SC-018 | reject → REJECTED + rejectReason | PASS | — | — | PASS | PASS |

### product 모듈 (SC-019~040)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | plan.md 시나리오 전체 | 상태 |
|---|---|---|---|---|---|---|
| SC-019 | PENDING 판매자 POST /products 403 | — | — | PASS | PASS | PASS |
| SC-020 | REJECTED 판매자 POST /products 403 | — | — | PASS | PASS | PASS |
| SC-021 | GET /categories 비인증 목록 | PASS | — | — | PASS | PASS |
| SC-022 | APPROVED POST /products DRAFT | PASS | — | — | PASS | PASS |
| SC-023 | 비승인 POST /products 403 | — | — | PASS | PASS | PASS |
| SC-024 | 본인 상품 수정 반영 | PASS | — | — | PASS | PASS |
| SC-025 | 타인 상품 수정 403 | — | — | PASS | PASS | PASS |
| SC-026 | publish DRAFT→ACTIVE | PASS | — | — | PASS | PASS |
| SC-027 | publish INACTIVE→ACTIVE | PASS | — | — | PASS | PASS |
| SC-028 | deactivate ACTIVE→INACTIVE | PASS | — | — | PASS | PASS |
| SC-029 | deactivate OUT_OF_STOCK→INACTIVE | PASS | — | — | PASS | PASS |
| SC-030 | 재고0 자동 OUT_OF_STOCK | — | PASS | — | PASS | PASS |
| SC-031 | 재고복구 자동 ACTIVE | — | PASS | — | PASS | PASS |
| SC-032 | variant 생성 + initStock 호출 | PASS | — | — | PASS | PASS |
| SC-033 | variant 수정 반영 | PASS | — | — | PASS | PASS |
| SC-034 | variant 삭제 | PASS | — | — | PASS | PASS |
| SC-035 | 이미지 추가 생성 | PASS | — | — | PASS | PASS |
| SC-036 | 이미지 10초과 400 | — | PASS | — | PASS | PASS |
| SC-037 | 이미지 삭제 | PASS | — | — | PASS | PASS |
| SC-038 | GET /products cursor·ACTIVE+OOS 필터 | PASS | PASS | — | PASS | PASS |
| SC-039 | 단건 ACTIVE/OOS 상세 OK / DRAFT·INACTIVE 404 | PASS | — | PASS | PASS | PASS |
| SC-040 | 본인 전체상태 목록 | PASS | — | — | PASS | PASS |

### inventory 모듈 (SC-041~046)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | plan.md 시나리오 전체 | 상태 |
|---|---|---|---|---|---|---|
| SC-041 | stock-in 재고 증가 + log(IN) | PASS | PASS | — | PASS | PASS |
| SC-042 | 재고 조회 수량 반환 | PASS | PASS | — | PASS | PASS |
| SC-043 | inventory_logs append-only (update/delete 부재) | PASS | — | — | PASS | PASS |
| SC-044 | checkAvailability 시그니처 존재 | PASS | — | — | PASS | PASS |
| SC-045 | decreaseStock 시그니처 존재 | PASS | — | — | PASS | PASS |
| SC-046 | 재고 부족 InsufficientStockException | — | PASS | PASS | PASS | PASS |

### 비기능 요구사항 (SC-047~051)

| SC-ID | 수용 기준 | Happy Path | Edge Case | Error Case | plan.md 시나리오 전체 | 상태 |
|---|---|---|---|---|---|---|
| SC-047 | GET /products P95 ≤500ms | — | PASS (P95=3ms) | — | PASS | PASS |
| SC-048 | 인증필수 endpoint 토큰없음 401 (가드 메타데이터) | PASS | — | — | PASS | PASS |
| SC-049 | cross-schema Prisma 모델 미참조 | PASS | — | — | PASS | PASS |
| SC-050 | price Decimal 선언 | PASS | — | — | PASS | PASS |
| SC-051 | @aws-sdk/* 신규 0 | PASS | — | — | PASS | PASS |

---

## 커버리지 요약

| 구분 | SC 수 | 전체 커버 | PASS | FAIL |
|---|---|---|---|---|
| unit (user) | 12 | 12 | 12 | 0 |
| unit (seller) | 6 | 6 | 6 | 0 |
| unit (product) | 22 | 22 | 22 | 0 |
| unit (inventory) | 6 | 6 | 6 | 0 |
| static | 5 | 5 | 5 | 0 |
| integration | 1 | 1 | 1 | 0 |
| **합계** | **51** | **51** | **51** | **0** |

**SC 커버리지**: 51/51 (100%)

---

## STALE_SC 경고

검출 범위: 본 차수 변경 파일 (apps/backend/src/ 하위 test 파일).
검출 결과: 0건. spec.md 에 없는 SC 번호가 docstring 에 잔존하는 케이스 없음.

- stale_sc.count: 0
- stale_sc.decision: NONE_FOUND
