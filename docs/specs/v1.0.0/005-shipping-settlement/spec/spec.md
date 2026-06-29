---
작성: main session (경량 모드)
버전: v1.0
최종 수정: 2026-06-29 17:17
상태: 확정 (구현 완료)
---

# Spec: 005-shipping-settlement (경량)

> Branch: 005-shipping-settlement | Date: 2026-06-29 | Version: v1.0.0
>
> **경량 모드 산출물**: 사용자 지시("경량 모드로 나머지 백엔드 진행")에 따라 plan/design/test-cases/DIFF 전체 문서를 생략하고,
> 본 spec.md 1장으로 요구사항·수용 기준·구현 결과를 통합 기록한다. 라인 단위 변경은 git(base `289b36f`)이 SoT.

## 목차

- [배경 및 목적](#배경-및-목적)
- [기능 요구사항](#기능-요구사항)
- [수용 기준](#수용-기준)
- [구현 결과](#구현-결과)
- [범위 외](#범위-외)
- [후속 주의사항](#후속-주의사항)

---

## 배경 및 목적

003-commerce(주문·결제) 완료 이후, 주문 이행(배송)과 판매자 정산 도메인을 구현한다.

- **배송(Shipping)**: APPROVED 판매자가 결제 완료된 주문에 송장을 등록하여 주문을 `preparing→shipped`로 전이하고, 배송 완료 시 주문을 `delivered`로 전이한다. 구매자/판매자가 배송 추적을 조회한다.
- **정산(Settlement)**: 관리자가 `completed` 주문항목을 집계하여 판매자별 정산을 생성한다. 정산액 = 총매출 − 수수료(10%). 판매자/관리자가 정산 내역을 조회한다.

## 기능 요구사항

- **FR-001**: APPROVED 판매자는 본인 주문에 송장(택배사·운송장번호)을 등록할 수 있다. 등록 시 주문 상태가 `preparing→shipped`로 전이된다.
- **FR-002**: 판매자는 배송 상태를 업데이트할 수 있고, `delivered` 전이 시 주문이 `delivered`로 전이된다.
- **FR-003**: 배송 추적 조회는 구매자 본인(`order.userId`) 또는 해당 주문의 판매자만 가능하다(권한 3축).
- **FR-004**: 관리자는 `completed` 주문항목을 판매자별로 집계하여 정산을 생성한다.
- **FR-005**: 정산액 계산은 Decimal로 수행한다. `commission = totalSales × 0.1`(ROUND_HALF_UP, 2자리), `payoutAmount = totalSales − commission`.
- **FR-006**: 판매자는 본인 정산만, 관리자는 전체 정산을 조회한다.

## 수용 기준

- **SC-001** (FR-001): `POST /shipments` → 송장 생성 + 주문 `shipped` 전이. 미승인 판매자/타인 주문 거부.
- **SC-002** (FR-002): `PATCH /shipments/:id/status` → `delivered` 시 주문 `delivered` 전이.
- **SC-003** (FR-003): `GET /shipments/:id/tracking` → 구매자/판매자만 200, 제3자 거부.
- **SC-004** (FR-004): `POST /settlements`(AdminGuard) → completed 항목 집계 정산 생성.
- **SC-005** (FR-005): 반올림 케이스(totalSales=100.05 → commission=10.01, payout=90.04) Decimal 정확.
- **SC-006** (FR-006): `GET /settlements`(본인) / `GET /admin/settlements`(AdminGuard).

## 구현 결과

검증 게이트 전부 통과(2026-06-29):
- `tsc --noEmit`: EXIT 0
- unit(`jest`): 18 suites, **189 PASS**(신규 21 + 기존 168, 회귀 0)
- static(e2e config): 9 suites, 47 PASS
- production AppModule 부팅: health e2e 3 PASS — ShippingModule·SettlementModule DI 정상(PATCH-01)
- 마이그레이션 `20260629080659_005_shipping_settlement` 생성·적용 + `prisma generate`

설계 결정:
- **모듈 경계(P-001)**: shipping/settlement repo는 자기 소유 테이블(orders 스키마 `shipments`·`shipment_tracking`, settlements 스키마 `settlements`·`settlement_items`)만 접근. 주문 데이터는 `OrderService` 공개 메서드(`markShipped`/`markDelivered`/`getOrderOwnership`/`getCompletedItemsForSettlement`)를 DI 경유로 획득. cross-schema FK는 plain String.
- **금전(P-005)**: 전부 `Prisma.Decimal` + `@db.Decimal(12,2)`. `commission` ROUND_HALF_UP 2자리.
- **권한 3축**: 추적 조회는 `order.userId`(구매자) 또는 `getOrderOwnership.sellerIds`(판매자). 미승인 판매자는 `getApprovedSeller` 예외 catch로 거부.
- 신규 외부 의존성 추가 없음(P-002).

변경 파일은 git base `289b36f` 기준 `git diff 289b36f -- apps/backend`로 재생성(전체 diff 박제 안 함).

## 범위 외

- 실제 택배사 API 연동(운송장 실시간 추적) — 송장 번호 저장·수동 상태 전이까지만.
- 정산 지급 실행(실제 이체) — 정산 레코드 생성·조회까지만.
- 정산 기간 필터는 주문 `createdAt` 기준(전용 `completedAt` 컬럼 부재로 단순화).

## 후속 주의사항

- **마이그레이션 드리프트**: 005 마이그레이션 SQL에 004(coupons·user_coupons·reviews) 테이블 생성도 포함됨. 004 모델이 schema.prisma엔 있었으나 별도 마이그레이션이 없던 기존 드리프트가 `migrate dev`에서 함께 캡처된 것. DB는 정상 동기화 상태. 백엔드 전체 완료 후 마이그레이션 히스토리 정리 검토 필요.
- 정산 기간 필터가 `createdAt` 기준이므로, 향후 정확한 정산 주기 산정이 필요하면 주문에 `completedAt` 컬럼 추가 검토.
