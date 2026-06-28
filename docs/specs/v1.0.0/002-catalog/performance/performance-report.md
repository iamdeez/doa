---
작성: Performance Agent
버전: v1.0
최종 수정: 2026-06-28 21:24
상태: 확정
---

# 성능 측정 및 최적화 결과

## 목차

- [검토 범위](#검토-범위)
- [Constitution 성능 원칙 조항 이행 현황](#constitution-성능-원칙-조항-이행-현황)
- [성능 목표](#성능-목표)
- [Baseline 측정 결과](#baseline-측정-결과)
- [병목 지점 분석](#병목-지점-분석)
- [최적화 적용 내역](#최적화-적용-내역)
- [최종 측정 결과](#최종-측정-결과)
- [미달성 항목 및 사유](#미달성-항목-및-사유)
- [회귀 테스트 결과](#회귀-테스트-결과)

---

## 검토 범위

**DIFF + research.md 영향 범위 분석 기반 확정 파일:**

| 파일 | 검토 사유 |
|---|---|
| `apps/backend/src/modules/product/product.repository.ts` | NFR-001 직결 경로 — `listPublic` cursor 쿼리 구현 |
| `apps/backend/src/modules/product/product.service.ts` | `listPublic` 서비스 레이어 — 후처리 추가 쿼리 여부 확인 |
| `apps/backend/prisma/schema.prisma` | `products.products` 테이블 `@@index` 선언 확인 |

**제외 파일 및 사유:**

| 파일 | 제외 사유 |
|---|---|
| `product.controller.ts` | HTTP 라우팅 레이어, DB 쿼리 경로 아님 |
| `product.events.ts`, `product.service.spec.ts` 등 | 이벤트 핸들러·테스트 코드 — 성능 경로 외 |
| user·seller·inventory 모듈 전체 | NFR-001 측정 대상 경로(`GET /products`)와 무관 |

---

## Constitution 성능 원칙 조항 이행 현황

constitution.md (`.claude/docs/constitution.md`) 에는 별도 성능 전용 조항(P-00X)이 없다.
성능에 간접 영향을 주는 조항만 존재하며, 각 이행 현황은 다음과 같다.

| 조항 | 내용 | 이행 현황 |
|---|---|---|
| P-001 (모듈 경계) | product 모듈은 products 스키마 테이블에만 Prisma 접근 | 준수 — `listPublic` 은 `products.products` 단일 테이블 쿼리 |
| P-003 (단일 DB) | 인-앱 LRU 캐시로 충분한 경우 외부 캐시 도입 금지 | 준수 — P95=3ms 달성, 외부 캐시 불필요 |
| P-007 (스펙 범위) | 스펙 외 성능 개선은 별도 spec 으로 분리 | 준수 — NFR-001 목표 달성, 스펙 외 최적화 미적용 |

---

## 성능 목표

| PERF-ID | NFR-ID | SC-ID | 목표값 | 측정 방법 | 측정 조건 |
|---|---|---|---|---|---|
| PERF-001 | NFR-001 | SC-047 | P95 ≤ 500ms | e2e 통합 테스트, `GET /products?limit=20` 100회 반복 | 로컬 docker-compose PostgreSQL, 상품 1,000개 미만 |

---

## Baseline 측정 결과

5b 단계(Test Agent EXECUTION)에서 실제 통합 환경으로 측정한 결과를 그대로 활용한다.
측정 환경: `doa-next-postgres-1` Docker PostgreSQL + 마이그레이션 적용 상태.

| PERF-ID | 측정 회차 | P95 측정값 | 목표값 | 달성 여부 |
|---|---|---|---|---|
| PERF-001 | 5b 단계 e2e (100회) | 3ms (상세 표) / 4ms (suite 요약) | 500ms | PASS |

> test-report.md §plan.md 매핑표: `SC-047 | P95=3ms | PASS`
> test-report.md §스위트별 결과: `products.e2e | P95=4ms | PASS`
> 두 수치 모두 목표 500ms 대비 125배 이상의 여유를 나타내며, 측정 오차 범위 내.

---

## 병목 지점 분석

### PERF-001 분석

#### cursor 페이지네이션 인덱스 활용 검증

`schema.prisma` Product 모델의 인덱스 선언:

```
@@index([status, createdAt(sort: Desc), id(sort: Desc)])
```

`product.repository.ts` `listPublic` 쿼리:

```typescript
this.prisma.product.findMany({
  where: { status: { in: [ProductStatus.ACTIVE, ProductStatus.OUT_OF_STOCK] } },
  orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  cursor: cursor ? { id: cursor } : undefined,
  skip: cursor ? 1 : 0,
  take,
});
```

인덱스 활용 판정:

| 쿼리 절 | 인덱스 컬럼 대응 | 판정 |
|---|---|---|
| `WHERE status IN [ACTIVE, OUT_OF_STOCK]` | 인덱스 1번 컬럼 `status` | 인덱스 필터 활용 |
| `ORDER BY createdAt DESC` | 인덱스 2번 컬럼 `createdAt DESC` | 인덱스 정렬 활용 |
| `ORDER BY id DESC` | 인덱스 3번 컬럼 `id DESC` | 인덱스 정렬 활용 (타이브레이커) |
| `cursor: { id: cursor }` | Primary Key `id` | 커서 레코드 단일 조회 후 위치 이동 |

**판정**: 복합 인덱스 `(status, createdAt DESC, id DESC)` 가 WHERE 필터와 ORDER BY 순서 모두를 커버. Index Range Scan + 정렬 없는 페이지 탐색 가능. 1,000개 미만 데이터 조건에서 P95=3ms 는 인덱스 정상 활용을 간접 증명한다.

#### N+1 쿼리 유무 분석

`product.repository.ts` `listPublic`:
- `include` 없음 → images·variants 테이블 미접근. 단일 `products.products` 테이블 SELECT.

`product.service.ts` `listPublic`:
```typescript
const items = await this.productRepository.listPublic(cursor, take);
const nextCursor = items.length === take ? items[items.length - 1].id : null;
return { items, nextCursor };
```
- `listPublic` 호출 후 추가 DB 쿼리 없음. nextCursor 계산은 JavaScript 배열 접근.

**판정**: 목록 조회 경로에 N+1 쿼리 없음.

참고: `findById`(상세 조회)는 `include: { images, variants }` 를 포함하나, 이는 단건 조회(1회 JOIN)이므로 N+1 구조가 아니다.

#### 병목 유형 판정

**구현 수준 병목 없음. 아키텍처 수준 성능 문제 없음.**

현재 구현은 다음 최적화 패턴이 이미 적용된 상태다:
1. 복합 인덱스로 index scan + 정렬 최적화
2. cursor 기반 페이지네이션 (offset 기반보다 대용량에서 효율적, ADR-007)
3. `orderBy` 복합 + `cursor=id` 조합으로 동률 레코드 누락 방지 (ADR-007)
4. 목록 조회 시 관련 테이블 미조인 (images·variants 분리 조회 구조)

---

## 최적화 적용 내역

추가 최적화 적용 없음.

기존 구현이 이미 목표 대비 충분한 성능(P95=3~4ms, 목표 500ms)을 달성하고 있으며,
constitution P-007(스펙 범위 원칙)에 따라 NFR-001 목표를 초과하는 스펙 외 최적화는 별도 spec으로 분리한다.

---

## 최종 측정 결과

| PERF-ID | Baseline | 최종값 | 목표 달성 여부 |
|---|---|---|---|
| PERF-001 | P95=3~4ms (5b 단계) | 재측정 불필요 (5b 결과 그대로) | PASS (목표 500ms 대비 125배 이상 여유) |

---

## 미달성 항목 및 사유

미달성 항목 없음. NFR-001 (PERF-001) 은 P95=3~4ms 로 목표 500ms를 초과 달성.

---

## 회귀 테스트 결과

| 항목 | 내용 |
|---|---|
| 테스트 총수 | 101건 |
| 통과 | 101건 |
| 실패 | 0건 |
| 출처 | test-report.md (Test Agent EXECUTION, 2026-06-28 확정) |

성능 검토 과정에서 소스코드 변경 없음. 회귀 재실행 불필요.
