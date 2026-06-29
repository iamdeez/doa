---
작성: Planning Agent
버전: v1.0
최종 수정: 2026-06-30 01:06
상태: 확정 (retroactive)
---

# Plan: 004-seller-order-shipping

> Branch: 004-seller-order-shipping | Date: 2026-06-30 | Spec: [../spec/spec.md](../spec/spec.md)

## 목차

- [사전 검증 (Constitution Gates)](#사전-검증-constitution-gates)
- [기술 컨텍스트](#기술-컨텍스트)
- [사전 영향도 분석 결과](#사전-영향도-분석-결과)
- [핵심 설계](#핵심-설계)
- [결정 기록 (ADRs)](#결정-기록-adrs)
- [인터페이스 계약](#인터페이스-계약)
- [데이터 모델](#데이터-모델)
- [테스트 전략](#테스트-전략)
- [보안 노트](#보안-노트)
- [기타 고려사항](#기타-고려사항)

---

## 사전 검증 (Constitution Gates)

> `constitution.md`(P-001~P-007) 존재 → 해당 조항을 Gates 로 사용한다(constitution 우선). 본 차수의 핵심
> 검토 조항은 **P-002(신규 의존 — 추가 0)**·**P-005(금전 Decimal 정합성)**·**P-007(스펙 범위)** 이며,
> 화면 동작 정합성은 P-006(테스트 — 빌드/타입/정적 갈음)으로 검증한다.

- [x] **P-001 모듈 경계 원칙**: [Pass 기준: 다른 도메인 모듈의 스키마 테이블을 직접 참조·쿼리하지 않음]
  → PASS. 본 차수는 **프론트엔드 console 화면 + 공유 패키지**(api-client·shared-types·ui) 변경이며 백엔드
  도메인 모듈·DB 스키마와 무관하다. DB 접근·교차 쿼리 0. 화면은 백엔드 HTTP 라우트(주문·배송 5개)만 호출.
- [x] **P-002 AWS 의존 금지 원칙**: [Pass 기준: `@aws-sdk/*` 및 AWS 전용 SDK 신규 추가 0건]
  → PASS(직접 검토 조항). **신규 의존성 추가 0건**(`package.json` dependencies 변경 없음 — numstat 에
  `package.json` 변경 부재). 기존 TanStack Query·`@doa/ui`·`@doa/api-client`·`@doa/shared-types` 만 사용.
- [x] **P-003 단일 DB 원칙**: [Pass 기준: 단일 PostgreSQL 외 외부 저장소 0건]
  → PASS(무관). 프론트 화면 변경으로 데이터 저장소·캐시·큐 0건. DB 스키마 변경 0(마이그레이션 없음).
  shipment 세션 state(`useState`)는 컴포넌트 메모리이며 영속 저장소가 아니다.
- [x] **P-004 클라우드 중립 원칙**: [Pass 기준: Fly.io 전용 API 결합 0건]
  → PASS. 표준 `fetch`(api-client)·TanStack Query·Next.js 만 사용. 플랫폼 전용 API 0.
- [x] **P-005 결제·정산 정합성 원칙**: [Pass 기준: 금전 상태 변경 outbox·멱등성·Decimal]
  → PASS(직접 검토 조항). 화면은 금전 상태를 **변경하지 않으며**(주문·배송 상태 전이만 백엔드 위임), 금전
  **표시** 만 한다. 결제금액은 Decimal→JSON 직렬화상 **문자열**로 받고 view 타입 금전 필드를 `string` 으로
  정의하며 `formatKRW` 가 부동소수점 연산 없이 표기한다(NFR-001). 클라이언트 금전 연산 0.
- [x] **P-006 테스트 원칙**: [Pass 기준: SC-XXX 없는 FR-XXX 0건]
  → PASS. FR-001·002→SC-001, FR-003→SC-002, FR-004·005·006→SC-003, FR-008·009→SC-004, FR-007·010→SC-005.
  UI 화면 성격상 별도 e2e/단위 테스트 스위트는 없으며 검증은 **타입체크 + console 빌드 + 정적 구조 검증**
  으로 갈음한다(모든 FR 이 SC 로 대응 — P-006 충족). 기존 console 테스트 커버리지 저하 0(NFR-005).
- [x] **P-007 스펙 범위 원칙**: [Pass 기준: spec.md 범위 외 변경 파일 0건]
  → PASS(직접 검토 조항). 변경 범위 = console 화면 2개(신규)·`lib/order.ts`(신규)·`layout.tsx`(네비·토큰)·
  `api-client/index.ts`(facade)·`shared-types/index.ts`(view 타입)·`ui/table.tsx`+`index.ts`(프리미티브).
  전부 FR-001~010 추적 가능. **rhf+zod·낙관적 업데이트·서버 페이지네이션·DataTable·판매자 주문 상세는 범위
  외**로 분리(Phase 2 / 백엔드 BE-GAP 의존).

> **예외 사항**: 없음. P-001~P-007 전부 통과(예외 0건). 신규 의존성 추가 0(P-002 무저촉 자명).

> **Gates 판정**: P-001~P-007 전부 통과(예외 0건). 선택 단계는 Database Design=N·Deploy=N·Security=N·
> Performance=N(selection-phases.md). Design Agent(3단계) → Development(4) + Test AUTHORING(5a) 진입 가능.

---

## 기술 컨텍스트

> v1.1.0 프론트 스택을 재확정. 004 고유 변경만 명시.

- **언어 / 런타임**: TypeScript 5.x / Next.js 15(App Router, console). pnpm `9.0.0` + Turborepo 모노레포.
- **상태·데이터 페칭**: TanStack Query(`@tanstack/react-query`) — `useQuery`(목록·추적)·`useMutation`
  (confirm·create·updateStatus)·`useQueryClient.invalidateQueries`(목록 갱신). ship 페이지의 생성 송장은
  컴포넌트 `useState`(세션 state).
- **UI**: `@doa/ui` 시맨틱 토큰 컴포넌트(Table·Badge·Button asChild·Card·Input·PageHeader·EmptyState·
  Loading·ErrorText). 본 차수에 Table 프리미티브 6종 신규 추가.
- **API 호출**: `@doa/api-client` 도메인 facade(`api.order`·`api.shipping` — `api.http` 기반). 003 타입드
  client 는 응답 미정의로 본 화면에 이점이 적어 facade 채택(research §응답 타입 처리).
- **타입**: `@doa/shared-types` 전이형 view 타입(`SellerOrder`·`Shipment`·`ShipmentTracking` 등 — 금전
  Decimal→문자열). 백엔드 응답 DTO 보강 후 생성 타입 대체 예정.
- **테스트 프레임워크**: 본 차수 별도 e2e/단위 테스트 없음(UI 화면). 검증 = 정적 구조 검증([env:static]) +
  `console typecheck`([env:typecheck]) + `console build` 라우트 컴파일([env:build]).
- **환경변수**: 신규 0. **신규 의존성**: 0건(기존 패키지만 사용).

---

## 사전 영향도 분석 결과

> 상세는 [../design/research.md](../design/research.md) 참조. 본 절은 영향 파일 요약.

### 영향 파일 목록

| 파일 | 변경 유형 | 영향 내용 | 레이어 |
|---|---|---|---|
| `packages/shared-types/src/index.ts` | 수정 | 주문·배송 view 타입 7종(`OrderStatus`·`SellerOrder`·`ShipmentStatus`·`Shipment`·`ShipmentTracking`·`CreateShipmentRequest`·`UpdateShipmentStatusRequest` — 금전 string) | A(타입 계약) |
| `packages/api-client/src/index.ts` | 수정 | `order`(listSeller·confirm)·`shipping`(create·updateStatus·tracking) facade 추가(`api.http` 기반, view 타입 응답 제네릭) | B(도메인 facade) |
| `packages/ui/src/table.tsx` | 신규 | 경량 Table 프리미티브(`Table`·`THead`·`TBody`·`TR`·`TH`·`TD` — 시맨틱 토큰) | B(UI 프리미티브) |
| `packages/ui/src/index.ts` | 수정 | Table 프리미티브 6종 재노출(1줄) | B(재노출) |
| `apps/console/lib/order.ts` | 신규 | `ORDER_STATUS_LABEL`/`ORDER_STATUS_TONE`·`SHIPMENT_STATUS_LABEL`·`formatKRW`(Decimal 문자열) | C(화면 헬퍼) |
| `apps/console/app/(dashboard)/seller/orders/page.tsx` | 신규 | 주문 목록(Table·상태 Badge·결제금액·주문일) + `OrderAction` 상태별 조치(confirm mutation·ship 링크) | C(화면) |
| `apps/console/app/(dashboard)/seller/orders/[id]/ship/page.tsx` | 신규 | 송장 등록 폼→발송, 배송 상태 전이(in_transit·delivered), 추적 이력. 생성 Shipment 세션 state | C(화면) |
| `apps/console/app/(dashboard)/layout.tsx` | 수정 | "주문·배송"(`/seller/orders`) 판매자 네비 추가 + 잔여 zinc→시맨틱 토큰 전환 | C(셸) |

> 백엔드·DB·`@doa/design-tokens`·003 의 타입드 client 변경 0건. 기존 console 화면(상품·계정·관리자) 불변
> (비파괴 — NFR-005). `package.json` 변경 0(신규 의존 0 — P-002).

### 변경 라인 직접 카운트 (자가 보고 비신뢰)

| 파일 | 추가 | 삭제 | 방법 |
|---|---|---|---|
| `apps/console/app/(dashboard)/seller/orders/[id]/ship/page.tsx`(신규) | 173 | 0 | `git diff --numstat 0db61b9 8bba04d` |
| `apps/console/app/(dashboard)/seller/orders/page.tsx`(신규) | 140 | 0 | 동일 |
| `packages/shared-types/src/index.ts` | 61 | 0 | 동일 |
| `apps/console/lib/order.ts`(신규) | 37 | 0 | 동일 |
| `packages/ui/src/table.tsx`(신규) | 35 | 0 | 동일 |
| `packages/api-client/src/index.ts` | 23 | 0 | 동일 |
| `apps/console/app/(dashboard)/layout.tsx` | 11 | 10 | 동일(네비 추가 + zinc→시맨틱 토큰) |
| `packages/ui/src/index.ts` | 1 | 0 | 동일(Table 재노출) |

**합계**: 8 files changed, 481 insertions(+), 10 deletions(-).

---

## 핵심 설계

### 1. 주문 목록 + 상태별 조치 (FR-001·002·003)

```tsx
// seller/orders/page.tsx
const { data, isLoading, error } = useQuery({
  queryKey: ['seller', 'orders'],
  queryFn: () => api.order.listSeller(),     // GET /seller/orders
  enabled: isSeller,
});
const confirm = useMutation({
  mutationFn: (orderId: string) => api.order.confirm(orderId),  // POST /seller/orders/:id/confirm
  onSuccess: () => qc.invalidateQueries({ queryKey: ['seller', 'orders'] }),
});
// 컬럼: 주문 ID(앞 12자…) · 상태 Badge(ORDER_STATUS_TONE/LABEL) · 결제금액(formatKRW, 우측) · 주문일 · 조치
```

- `OrderAction` 상태 머신: `confirmed`→"주문 확인" 버튼(confirm mutation) / `preparing`→"송장 등록"
  링크(`/seller/orders/[id]/ship`) / `shipped`·`delivered`→"배송 관리" 링크(동일) / 그 외→"—".
- 로딩(`Loading`)·에러(`ErrorText` + `ApiError` instanceof)·빈 목록(`EmptyState`)·비판매자(`EmptyState`
  "판매자 미등록") 분기.

### 2. 송장 등록 → 발송 → 배송 전이 → 추적 (FR-004·005·006)

```tsx
// seller/orders/[id]/ship/page.tsx
const [shipment, setShipment] = useState<Shipment | null>(null);
const create = useMutation({
  mutationFn: () => api.shipping.create({ orderId, carrier, trackingNumber }),  // POST /shipments
  onSuccess: (s) => setShipment(s),                  // 생성 Shipment 세션 state 보관
});
const updateStatus = useMutation({
  mutationFn: (status: ShipmentStatus) => api.shipping.updateStatus(shipment!.id, { status }),
  onSuccess: (s) => setShipment(s),
});
const tracking = useQuery({
  queryKey: ['shipment', shipment?.id, 'tracking'],
  queryFn: () => api.shipping.tracking(shipment!.id),
  enabled: !!shipment,                               // 송장 존재 시에만 추적 조회
});
```

- 송장 미등록(`!shipment`): 등록 폼(carrier·trackingNumber `Input`, 빈 값 비활성화) — 등록 시 발송
  (preparing→shipped).
- 송장 등록 후: 배송 상태 Card(택배사·운송장 표시 + "배송중 처리"=`in_transit`·"배송완료 처리"=`delivered`,
  `delivered` 시 버튼 비활성화) + 추적 이력 Card(상태·설명·발생 시각 시간순).

### 3. 상태 라벨·톤·금전 매핑 (FR-002·NFR-001)

```ts
// lib/order.ts
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = { pending:'결제대기', confirmed:'결제완료', preparing:'상품준비', shipped:'배송중', delivered:'배송완료', completed:'구매확정', cancelled:'취소' };
export const ORDER_STATUS_TONE: Record<OrderStatus, BadgeTone> = { /* neutral·info·warning·info·success·success·danger */ };
export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = { preparing:'준비', shipped:'발송', in_transit:'배송중', delivered:'배송완료' };
export function formatKRW(amount: string): string { const n = Number(amount); return Number.isFinite(n) ? `${n.toLocaleString('ko-KR')}원` : `${amount}원`; }
```

### 4. view 타입 + 도메인 facade (FR-008·009)

```ts
// shared-types/index.ts — 백엔드 응답 OpenAPI 미정의(Prisma 엔티티) → 전이형 view 타입(금전 string)
export interface SellerOrder { id; userId; status: OrderStatus; totalAmount: string; discountAmount: string; deliveredAt: string|null; completedAt: string|null; createdAt: string; }
// api-client/index.ts
order: {
  listSeller: () => http.get<SellerOrder[]>('/seller/orders'),
  confirm: (orderId) => http.post<void>(`/seller/orders/${orderId}/confirm`),
},
shipping: {
  create: (body: CreateShipmentRequest) => http.post<Shipment>('/shipments', body),
  updateStatus: (id, body: UpdateShipmentStatusRequest) => http.patch<Shipment>(`/shipments/${id}/status`, body),
  tracking: (id) => http.get<ShipmentTracking[]>(`/shipments/${id}/tracking`),
},
```

### 5. Table 프리미티브 + AppShell 네비·토큰 (FR-007·010·NFR-002)

```tsx
// ui/table.tsx — 시맨틱 토큰(border-border·bg-muted/50·divide-border·text-foreground). 확장 시 TanStack Table.
export function Table(...) { /* overflow-x-auto rounded-card border border-border */ }
// layout.tsx — 판매자 네비에 { href: '/seller/orders', label: '주문·배송', section: 'seller' } 추가
//             + 잔여 zinc → 시맨틱 토큰(border-border·bg-surface·text-muted-foreground·bg-accent·text-on-accent)
```

---

## 결정 기록 (ADRs)

| ADR-ID | 결정 항목 | 채택안 | 대안(검토했으나 미채택) | 근거(spec FR/NFR) | 영향 범위 |
|---|---|---|---|---|---|
| ADR-001 | 응답 호출 도구 | `api.http` 기반 도메인 facade + view 타입 | 003 타입드 `api.client.GET` | FR-008·009(응답 OpenAPI 미정의 — 타입드 이점 적음) | shared-types·api-client |
| ADR-002 | 응답 타입 정의 위치 | `@doa/shared-types` 전이형 view 타입(금전 string) | 화면 로컬 타입 | FR-008, NFR-001 | shared-types |
| ADR-003 | 목록 렌더 컴포넌트 | 경량 Table 프리미티브(`@doa/ui`) | DataTable(TanStack Table) | FR-010(정렬·필터 미요구) | ui/table.tsx |
| ADR-004 | ship 송장 상태 보관 | 송장 등록 직후 세션 state(`useState`) | 서버 재조회 | FR-004(주문→송장 조회 엔드포인트 부재 — BE-GAP) | ship/page.tsx |
| ADR-005 | 폼 검증 | 제어 컴포넌트 + 빈 값 비활성화 | rhf+zod | spec §범위 외(Phase 2) | ship/page.tsx |
| ADR-006 | 권한 강제 | 백엔드 강제 + UI 표시 분기(`isSeller`) | UI 강제 | NFR-003 | page.tsx·ship/page.tsx |
| ADR-007 | 금전 표기 | Decimal→문자열 `formatKRW`(부동소수점 금지) | number 연산 | NFR-001, P-005 | lib/order.ts·view 타입 |

---

## 인터페이스 계약

### 백엔드 라우트 계약 (실제 — 호출 측 의존)

| 라우트 | 메서드 | 요청 | 응답(view 타입) | 부수 효과 |
|---|---|---|---|---|
| `/seller/orders` | GET | — | `SellerOrder[]`(items 미포함) | 판매자 본인 주문 목록(최신순) |
| `/seller/orders/:id/confirm` | POST | — | `void` | 주문 `confirmed → preparing` |
| `/shipments` | POST | `CreateShipmentRequest`(orderId·carrier·trackingNumber) | `Shipment` | 주문 `preparing → shipped` |
| `/shipments/:id/status` | PATCH | `UpdateShipmentStatusRequest`(status enum·description?) | `Shipment` | `delivered` 시 주문도 `delivered` |
| `/shipments/:id/tracking` | GET | — | `ShipmentTracking[]` | 권한 3축(구매자/판매자) |

### 004 신규/변경 프론트 인터페이스

```ts
// api-client/index.ts — createApiClient 반환에 추가
order: { listSeller(): Promise<SellerOrder[]>; confirm(orderId: string): Promise<void>; };
shipping: {
  create(body: CreateShipmentRequest): Promise<Shipment>;
  updateStatus(id: string, body: UpdateShipmentStatusRequest): Promise<Shipment>;
  tracking(id: string): Promise<ShipmentTracking[]>;
};
// ui/index.ts — export { Table, THead, TBody, TR, TH, TD } from './table';
```

### 하위 호환성 / 방어 코드

- **기존 facade·화면 비파괴(핵심)**: `createApiClient` 반환에 `order`·`shipping` 을 **추가** 할 뿐 기존
  facade(auth·user·seller·catalog·inventory·http·client)와 console 화면은 불변(타입체크 회귀 0 — NFR-005·
  SC-005).
- **금전 부동소수점 방어**: `formatKRW` 가 `Number.isFinite` 검사로 비유한값은 원문(`${amount}원`)으로
  표기한다. view 타입 금전 필드는 `string` 이므로 클라이언트가 Decimal 정밀도를 훼손하지 않는다(P-005).
- **세션 state 한계(BE-GAP)**: ship 페이지는 송장 등록 직후 세션 state 의 shipment 로 상태변경·추적이
  동작한다(세션 내 완결). 주문→송장 조회 엔드포인트 부재로 재진입 시 기존 shipment 복구 불가하며, 이미
  발송된 주문 재등록 시도는 백엔드가 400(주문이 preparing 아님)으로 거부한다(GAP-004-01).
- **권한 표시 분기**: 비판매자는 목록 `EmptyState`·ship `ErrorText` 로 분기되나, 실제 데이터 보호는 백엔드
  판매자 스코프·권한 3축이 강제한다(NFR-003 — UI 는 표시만).

---

## 데이터 모델

DB 스키마 변경 없음(마이그레이션 0). 신규 테이블·컬럼·enum·인덱스·제약 0건. 본 차수의 "데이터"는 런타임 DB
데이터가 아닌 **HTTP 응답 view 타입**(`@doa/shared-types` 의 전이형 타입 — 백엔드 Prisma 엔티티 응답을
프론트가 한시 표현)이며, 화면은 이를 **소비·표시** 할 뿐 영속하지 않는다. ship 페이지의 `useState<Shipment>`
는 컴포넌트 세션 메모리로 신규 저장소가 아니다. Database Design Agent 비활성(selection-phases.md).

> **view 타입 한시성**: 응답 view 타입은 백엔드 OpenAPI 응답 정의가 보강되면 생성 타입(`Schemas['...']`)으로
> 대체될 임시 계약이다(GAP-004-01 / 001 GAP-001-01 연속). 정의 위치는 공유 패키지(`shared-types`)이므로
> 백엔드 응답 DTO 보강 시 한 곳에서 교체 가능하다.

---

## 테스트 전략

### SC↔검증 매핑 (요약)

| SC 식별자 | 수준 | 유형 | 시나리오 요약 | 입력 | 기대 결과 |
|---|---|---|---|---|---|
| SC-001 | typecheck/build | 목록 렌더 | 주문 목록 Table·상태 Badge·formatKRW | console typecheck/build | `/seller/orders` 라우트 컴파일·상태 라벨/톤·금전 표기 |
| SC-002 | static | 조치 분기 | `OrderAction` 상태별 분기 | page.tsx 코드 리뷰 | confirmed→confirm·preparing→ship·shipped/delivered→ship·그 외 "—", invalidate |
| SC-003 | typecheck/build | 송장·배송·추적 | create→발송·updateStatus·tracking·세션 state | ship/page.tsx·console build | `/seller/orders/[id]/ship` 동적(ƒ) 컴파일·delivered 비활성화 |
| SC-004 | static/typecheck | view 타입·facade | view 타입 7종·order/shipping facade | shared-types·api-client 코드 리뷰 | 금전 string·facade 메서드·view 응답 제네릭 |
| SC-005 | static/typecheck/build | 네비·토큰·프리미티브·회귀 | 네비·zinc→시맨틱·Table·회귀 0 | layout·ui·console typecheck/build | 네비 추가·잔여 zinc 0·Table 재노출·14 라우트 PASS |

### smoke_tests

- 필요 여부: N(별도 부팅 스모크 불필요). 본 차수는 UI 화면으로, 검증은 **타입체크(`console typecheck`) +
  console 빌드(신규 2 라우트 컴파일 — `/seller/orders` 정적 ○·`/seller/orders/[id]/ship` 동적 ƒ) + 정적
  구조 검증(상태별 조치 분기·view 타입·facade·금전 포맷·네비·토큰)** 으로 갈음한다. 별도 e2e/단위 테스트
  스위트는 작성하지 않으며, 기존 console 빌드·타입체크가 회귀 0 으로 유지된다. e2e·rhf 검증·낙관적 업데이트
  테스트는 후속 권고(GAP-004-01).

---

## 보안 노트

> Security Agent: N(selection-phases.md). 본 절로 보안 영향 분석을 갈음한다.

- **권한 강제는 백엔드(핵심)**: 본 화면은 클라이언트이며 실제 인가는 백엔드가 강제한다. `GET /seller/orders`
  는 판매자 본인 스코프, `/shipments/:id/tracking` 은 권한 3축(구매자/판매자)으로 보호된다. UI 의 `isSeller`
  분기는 표시 편의일 뿐 데이터 보호가 아니며, 비판매자가 라우트에 직접 접근해도 백엔드가 차단한다(NFR-003).
- **금전 정합성(P-005)**: 화면은 금전 상태를 변경하지 않고 표시만 하며, Decimal 을 문자열로 받아 부동소수점
  연산 없이 표기한다(`formatKRW`). 결제·정산 상태 변경 로직 0.
- **신규 공격 표면**: 신규 의존성 0, 신규 네트워크 엔드포인트 0(기존 백엔드 라우트 소비). 송장 등록 폼은
  제어 컴포넌트로 입력을 백엔드 DTO(class-validator)에 위임한다. OWASP Top 10 관점의 신규 공격 표면 없음.
- **결론**: 인가는 백엔드 위임(클라이언트 표시 분기), 금전은 표시 전용·부동소수점 미연산. 보안 감사 대상
  부재(Security Agent: N — selection-phases.md).

---

## 기타 고려사항

- **응답 타입 처리(핵심)**: 주문·배송 엔드포인트는 백엔드가 Prisma 엔티티를 반환하고 OpenAPI 에 응답 스키마가
  미정의다(001 coverage-gap). 따라서 003 의 타입드 client 는 응답 타입이 비어 본 화면에서 이점이 적어,
  `api.http` 기반 도메인 facade + `@doa/shared-types` 전이형 view 타입을 채택했다(ADR-001). 요청 측(params·
  body)은 정확하나 응답은 한시 view 타입이며, 백엔드 응답 DTO + `@ApiResponse({ type })` 보강 후 코드젠
  재생성하면 생성 타입으로 대체 가능하다(GAP-004-01 / 001 GAP-001-01 연속).
- **ship 페이지 재진입 한계(BE-GAP)**: 주문→송장 조회 엔드포인트(`GET /shipments?orderId` 또는 주문에
  shipment 포함)가 부재하여, 이미 발송된 주문에 ship 페이지로 재진입하면 기존 shipment id 를 복구할 수 없다.
  현재는 송장 등록 직후 세션 state 의 shipment id 로 상태변경·추적이 동작한다(세션 내 완결). 재진입 시
  재등록 시도는 백엔드가 400(주문이 preparing 아님)으로 거부한다. 판매자용 단건 주문 상세 엔드포인트
  부재(`GET /orders/:id` 는 구매자 스코프)도 함께 BE-GAP 으로 기록한다(GAP-004-01).
- **상태 머신 매핑**: 주문 상태(7종)와 배송 상태(4종)는 백엔드가 전이를 강제하며, 프론트는 라벨·톤 매핑과
  조치 분기만 담당한다. confirmed→preparing(주문 확인)·preparing→shipped(송장 등록)·shipped/in_transit→
  delivered(배송완료, 주문도 delivered)는 모두 백엔드 전이다.
- **Phase 2 후속(범위 외)**: rhf+zod 폼 검증·낙관적 업데이트·서버 페이지네이션(현재 전체 배열)·DataTable
  (TanStack) 정렬/필터는 본 차수 범위 외이며 Phase 2 후속이다(GAP-004-01). Table 프리미티브 주석에 "정렬·
  필터가 필요해지면 TanStack Table 로 확장" 명시.
- **신규 의존 0**: 본 차수는 기존 패키지(TanStack Query·`@doa/ui`·`@doa/api-client`·`@doa/shared-types`)만
  사용하며 `package.json` 변경이 없다(P-002 무저촉 자명, NFR-005 회귀 0 유리).
</content>
