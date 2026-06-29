---
작성: Test Agent (AUTHORING)
버전: v1.0
최종 수정: 2026-06-30 01:06
상태: 확정 (retroactive)
---

# Test Cases: 004-seller-order-shipping

## 목차

- [SC × 시나리오 매트릭스](#sc--시나리오-매트릭스)
- [케이스 상세](#케이스-상세)
- [외부 의존성 명시](#외부-의존성-명시)
- [미커버 항목 (사전 분류)](#미커버-항목-사전-분류)

---

## SC × 시나리오 매트릭스

> 본 차수는 UI 화면으로 **단위/e2e 테스트 it() 를 추가하지 않는다**. 검증은 타입체크([env:typecheck]) +
> console 빌드([env:build]) + 정적 구조 검증([env:static] — 상태별 조치 분기·view 타입·facade·금전 포맷·
> 네비·토큰 코드 리뷰)으로 SC 를 판정한다. 구조는 추측하지 않고 실제 코드를 직접 확인한다.

| SC-ID | 수용 기준 | Happy Path | Edge Case | 검증 대상 | env 태그 |
|---|---|---|---|---|---|
| SC-001 | 목록 렌더·상태 Badge·금전 | 목록 Table 렌더 + formatKRW | 빈 목록 EmptyState·비판매자 안내 | orders/page.tsx·console | [env:typecheck][env:build] |
| SC-002 | 상태별 조치 분기 | confirmed→confirm·preparing/shipped/delivered→ship 링크 | pending/completed/cancelled → "—" | orders/page.tsx OrderAction | [env:static] |
| SC-003 | 송장·배송·추적·세션 state | create→발송·updateStatus·tracking | delivered 송장 버튼 비활성화·ship 재진입 복구 불가(BE-GAP) | ship/page.tsx·console | [env:typecheck][env:build] |
| SC-004 | view 타입·facade | view 타입 7종·order/shipping facade | 응답 OpenAPI 미정의 → 전이형 view 타입 | shared-types·api-client | [env:static][env:typecheck] |
| SC-005 | 네비·토큰·프리미티브·회귀 0 | 네비 추가·Table 재노출·14 라우트 | 잔여 zinc 0·기존 화면 불변 | layout·ui·console | [env:static][env:typecheck][env:build] |

---

## 케이스 상세

### SC-001 (목록 렌더·상태 Badge·금전)

- 검증 방법: `orders/page.tsx` 코드 리뷰 + console typecheck/build.
- 확인 사실:
  - `useQuery({ queryKey: ['seller','orders'], queryFn: () => api.order.listSeller(), enabled: isSeller })`.
  - Table(`@doa/ui` Table·THead·TBody·TR·TH·TD) 컬럼: 주문 ID(`order.id.slice(0,12)…`)·상태
    `<Badge tone={ORDER_STATUS_TONE[order.status]}>{ORDER_STATUS_LABEL[order.status]}</Badge>`·결제금액
    `formatKRW(order.totalAmount)`(우측 정렬)·주문일(`toLocaleDateString('ko-KR')`)·조치.
  - 분기: `isLoading`→`Loading`, `error`→`ErrorText`(ApiError instanceof), `data.length === 0`→`EmptyState`,
    `!isSeller`→`EmptyState`("판매자 미등록").
  - `pnpm --filter console typecheck` 0 error + `pnpm --filter console build` 에 `/seller/orders`(○ 정적)
    라우트 컴파일.

### SC-002 (상태별 조치 분기)

- 검증 방법: `orders/page.tsx` `OrderAction` 코드 리뷰.
- 확인 사실:
  - `switch (order.status as OrderStatus)`: `confirmed`→`<Button onClick={onConfirm}>주문 확인</Button>`,
    `preparing`→`<Button asChild><Link href={shipHref}>송장 등록</Link></Button>`, `shipped`·`delivered`→
    `<Button variant="ghost" asChild><Link href={shipHref}>배송 관리</Link></Button>`, `default`→
    `<span>—</span>`.
  - `shipHref = /seller/orders/${order.id}/ship`.
  - confirm `useMutation({ mutationFn: api.order.confirm, onSuccess: () => qc.invalidateQueries({ queryKey:
    ['seller','orders'] }) })`. 처리 중 버튼 비활성화·라벨 "처리 중…".

### SC-003 (송장·배송·추적·세션 state)

- 검증 방법: `ship/page.tsx` 코드 리뷰 + console build.
- 확인 사실:
  - `const [shipment, setShipment] = useState<Shipment | null>(null)`.
  - 미등록(`!shipment`): 등록 폼(`Input` carrier·trackingNumber, `disabled: create.isPending || !carrier ||
    !trackingNumber`) → `create.mutate()` → `api.shipping.create({ orderId, carrier, trackingNumber })` →
    `onSuccess(s) setShipment(s)`(발송 — preparing→shipped).
  - 등록 후: 배송 Card(`updateStatus.mutate('in_transit')`="배송중 처리"·`updateStatus.mutate('delivered')`=
    "배송완료 처리", `disabled: ... || shipment.status === 'delivered'`) + 추적 Card(`tracking = useQuery(
    ['shipment', shipment?.id, 'tracking'], api.shipping.tracking, { enabled: !!shipment })`, 상태·설명·
    `occurredAt` 시간순).
  - `pnpm --filter console build` 에 `/seller/orders/[id]/ship`(ƒ 동적) 라우트 컴파일.

### SC-004 (view 타입·facade)

- 검증 방법: `shared-types/index.ts`·`api-client/index.ts` 코드 리뷰.
- 확인 사실:
  - `shared-types/index.ts`: `OrderStatus`(7값)·`SellerOrder`(`totalAmount`/`discountAmount`: `string`)·
    `ShipmentStatus`(4값)·`Shipment`·`ShipmentTracking`·`CreateShipmentRequest`·`UpdateShipmentStatusRequest`.
    주석 "백엔드 응답이 OpenAPI 에 미정의(Prisma 엔티티 반환)이므로 전이형 view 타입으로 한시 정의".
  - `api-client/index.ts`: `order: { listSeller: () => http.get<SellerOrder[]>('/seller/orders'), confirm:
    (orderId) => http.post<void>(\`/seller/orders/${orderId}/confirm\`) }`, `shipping: { create, updateStatus,
    tracking }`(`Shipment`·`ShipmentTracking[]` 응답 제네릭).

### SC-005 (네비·토큰·프리미티브·회귀 0)

- 검증 방법: `layout.tsx`·`ui/table.tsx`·`ui/index.ts` 코드 리뷰 + console typecheck/build.
- 확인 사실:
  - `layout.tsx`: `NAV` 에 `{ href: '/seller/orders', label: '주문·배송', section: 'seller' }`. 시맨틱
    토큰(`border-border`·`bg-surface`·`text-muted-foreground`·`bg-accent`·`text-on-accent`·`bg-muted`·
    `rounded-control`) — 잔여 zinc 0.
  - `ui/table.tsx`: `Table`·`THead`·`TBody`·`TR`·`TH`·`TD`(`border-border`·`bg-muted/50`·`divide-border`·
    `text-foreground`·`rounded-card`). 주석 "정렬·필터가 필요해지면 TanStack Table 로 확장".
  - `ui/index.ts`: `export { Table, THead, TBody, TR, TH, TD } from './table';`.
  - `pnpm --filter console typecheck` 0 error + `pnpm --filter console build` 14 라우트 PASS — 기존 화면
    (상품·계정·관리자) 회귀 0(NFR-005).

---

## 외부 의존성 명시

### 도구 / 라이브러리

- `@tanstack/react-query`(기존): `useQuery`·`useMutation`·`useQueryClient.invalidateQueries`.
- `@doa/ui`(기존 + Table 6종 신규): Table·Badge·Button(asChild)·Card·Input·PageHeader·EmptyState·Loading·
  ErrorText.
- `@doa/api-client`(기존 + order·shipping facade 신규): `api.order`·`api.shipping`(`api.http` 기반).
- `@doa/shared-types`(기존 + view 타입 7종 신규): `SellerOrder`·`Shipment`·`ShipmentTracking` 등.
- **신규 의존성 0**(`package.json` 변경 없음).

### 환경 변수

- 별도 환경 변수 불필요. API `baseUrl`·`TokenStore` 는 기존 console `lib/api` 가 `createApiClient` 에 주입.

### 외부 서비스

- 검증 단계에서 실제 백엔드 호출 없음. 검증은 정적 구조 리뷰 + 타입체크 + console 빌드(라우트 컴파일)로
  수행(테스트 서버 기동·네트워크 호출 아님).

---

## 미커버 항목 (사전 분류)

| 항목 | 미커버 사유 | 카테고리 | 권장 검증 방법 |
|---|---|---|---|
| e2e 자동화 | 본 차수는 UI 화면이나 별도 e2e/단위 테스트 부재(빌드/타입체크/정적 갈음) | (2) 설계(테스트 자동화 한계) | Playwright 등으로 목록 렌더·송장 등록·배송 전이 흐름 e2e 후속 |
| BE-GAP 의존 시나리오 | ship 재진입 시 기존 송장 복구·판매자 주문 상세 — 백엔드 엔드포인트 부재로 미구현 | (3) 기능 미구현(BE-GAP 의존) | 백엔드에 주문→송장 조회·판매자 단건 주문 엔드포인트 추가 후 재진입 복구 구현 |
| rhf+zod 폼 검증 | 송장 등록 폼은 제어 컴포넌트 + 빈 값 비활성화 수준(rhf+zod 미적용) | (3) 기능 미구현(범위 외) | Phase 2 에서 rhf+zod 스키마 검증 + 검증 테스트 추가 |
| 낙관적 업데이트 | mutation 은 서버 응답 후 setState/invalidate(낙관적 미적용) | (3) 기능 미구현(범위 외) | Phase 2 에서 `onMutate` 낙관적 업데이트 + 롤백 테스트 |
</content>
