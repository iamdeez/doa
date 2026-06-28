---
작성: Design Agent
버전: v1.1
최종 수정: 2026-06-28
상태: 누적 기록 중
---

# Gaps: 002-catalog

> 3단계(Design)에서 최초 생성. 이후 모든 Agent 가 누적 기록한다.
> 형식: `pipeline-conventions.md §6`. 해결 시 상태를 `RESOLVED by [Agent 공식명]` 으로 갱신한다.

## 목차

- [GAP-001](#gap-001)
- [GAP-002](#gap-002)
- [GAP-003](#gap-003)
- [GAP-004](#gap-004)
- [GAP-005](#gap-005)

---

## GAP-001

- **유형**: 문서-갱신-필요 / 설계
- **출처**: Design Agent
- **컨텍스트**: 카테고리 seed (ADR-010) / Layer A T-A4 / `apps/backend/package.json`
- **상태**: RESOLVED by Database Design Agent
- **내용**:
  plan.md 기술 컨텍스트·인터페이스 계약은 "`package.json` 무변경(NFR-005)" 을 명시하나, 카테고리 seed 데이터(ADR-010) 를
  `prisma db seed` 메커니즘으로 실행하려면 `apps/backend/package.json` 에 `"prisma": { "seed": "ts-node prisma/seed.ts" }`
  설정 키 추가가 필요하다. 현재 `package.json` 에 `prisma.seed` 키는 없다(확인 완료).
- **분석**:
  - 이는 **의존성 추가가 아니다**(ts-node 는 기존 devDependency). 따라서 SC-051(`@aws-sdk/*` 신규 0)·NFR-005(AWS SDK 신규 의존 0) 위반이 아니다.
  - 단 plan 의 "package.json 무변경" 서술과 표면 상충하므로 가시화한다.
  - **대안**: seed 를 마이그레이션 SQL 의 `INSERT` 문(ADR-010 가 "마이그레이션 seed" 도 허용)으로 처리하면 `package.json` 무변경 유지 가능.
- **처리 방향**: DB Design Agent 가 대안 ②(마이그레이션 SQL `INSERT ... ON CONFLICT DO NOTHING`) 를 채택하여 `20260628000003_products_schema_extension.sql` 에 카테고리 seed 8개를 포함.
  `apps/backend/package.json` 무변경 유지 → NFR-005·plan "package.json 무변경" 서술 완전 충족.
- **블로킹 여부**: 비블로킹. 해소 완료.

---

## GAP-002

- **유형**: 문서-갱신-필요
- **출처**: Docs Agent
- **컨텍스트**: `{project}/.claude/docs/context.md` §1·§2·§6
- **상태**: OPEN
- **내용**:
  002-catalog 구현 완료로 context.md 세 섹션이 현재 코드베이스와 불일치.

  **§1 프로젝트 개요 — 설명 주석 현행화**:
  현재: "auth 실구현 + 17 스텁"
  변경 후: "auth·user·seller·product·inventory 5개 실구현 + 13 스텁"

  **§2 핵심 도메인 모듈 목록 — 구현 상태 주석 현행화**:
  현재: "auth 만 실구현(controller/service/repository/dto). 나머지 17개(user~admin)는 4계층 빈 스텁"
  변경 후: "auth·user·seller·product·inventory 5개 실구현. 나머지 13개(cart~admin)는 4계층 빈 스텁(Stage 3 대상)"

  **§2 공통(shared)·인프라 모듈 — OptionalJwtAuthGuard 추가**:
  현재 `shared/auth` 행의 역할 설명: "JwtStrategy · JwtAuthGuard · @CurrentUser 데코레이터"
  변경 후: "JwtStrategy · JwtAuthGuard · OptionalJwtAuthGuard · @CurrentUser 데코레이터" 추가

  **§6 알려진 제약 — "17개 도메인 모듈 빈 스텁" 행 수정 + 신규 항목 2건 추가**:
  1. "17개 도메인 모듈 빈 스텁" → "13개 도메인 모듈 빈 스텁(cart~admin)" 로 갱신 (4개 구현 완료)
  2. 신규: "admin RBAC 미구현 (ASM-005)" — seller approve/reject 엔드포인트(`PATCH /sellers/:id/approve·reject`)에
     `AdminGuard` 없음. JwtAuthGuard 만 적용 중. 관리자 전용 보호 없이 모든 로그인 사용자가 호출 가능.
  3. 신규: "cross-schema plain String 참조 제약 (P-001·ADR-001)" — users·products 스키마 간 외래키 선언 없음.
     Wishlist.productId, ProductView.productId, Product.sellerId, InventoryLog.variantId/productId 는
     모두 plain String 으로 상대 스키마를 참조. DB 수준 참조 무결성 없으며, 삭제 시 고아 레코드 발생 가능(의도적).

- **코드 검증 (PROC-002)**:
  - `apps/backend/src/modules/user/user.service.ts`: 실구현 확인 (git diff 기준 +143 라인)
  - `apps/backend/src/modules/seller/seller.service.ts`: getApprovedSeller 포함 실구현 확인 (+108 라인)
  - `apps/backend/src/modules/product/product.service.ts`: 실구현 확인 (+238 라인)
  - `apps/backend/src/modules/inventory/inventory.service.ts`: 실구현 확인 (+97 라인)
  - `apps/backend/src/shared/auth/auth-shared.module.ts`: OptionalJwtAuthGuard 등록·export 확인 (+3 라인)
  - `apps/backend/src/modules/seller/seller.controller.ts` L57-71: approve/reject 핸들러에 @UseGuards(JwtAuthGuard) 클래스 레벨만, AdminGuard 없음 확인

- **갱신 권고**:
  - `context.md §1`: 설명 주석 "auth 실구현 + 17 스텁" → "auth·user·seller·product·inventory 5개 실구현 + 13 스텁"
  - `context.md §2` (핵심 도메인 모듈 목록 하단 주석): 위 §2 변경 후 내용으로 교체
  - `context.md §2` (공통 모듈 shared/auth 행): OptionalJwtAuthGuard 추가
  - `context.md §6`: "17개 도메인 모듈 빈 스텁" 행 → "13개" 로 수정 + 신규 항목 2건 추가

- **블로킹 여부**: 비블로킹. Retrospective Agent 처리 위임.

---

## GAP-003

- **유형**: 문서-갱신-필요
- **출처**: Docs Agent
- **컨텍스트**: `{project}/.claude/docs/context.md` §3.2·§4·§5
- **상태**: OPEN
- **내용**:
  002-catalog 구현 완료로 context.md 세 섹션이 현재 코드베이스와 불일치.

  **§4 데이터 모델 — v1.0.0 실재 상태 주석 현행화**:
  현재: "users 스키마에 users·refresh_tokens 2개 테이블만 실체화"
  변경 후: "users 스키마 6테이블 + products 스키마 6테이블 = 12개 테이블 실체화"
  - users 스키마: users, refresh_tokens (기존 2) + sellers, addresses, wishlists, product_views (신규 4)
  - products 스키마: categories, products, product_images, variants, inventory, inventory_logs (신규 6)
  추가 보정: 현재 §4 스키마 목록에 `products.options` 테이블이 기재되어 있으나,
  Prisma schema.prisma 에 options 모델이 없다. variant 가 optionName·optionValue 인라인 필드로 흡수.
  `(categories, products, product_images, options, variants, inventory, inventory_logs)` →
  `(categories, products, product_images, variants, inventory, inventory_logs)` 로 수정 필요.

  **§3.2 이벤트 흐름 — 002-catalog 실구현 이벤트 추가**:
  현재 테이블에 누락된 실구현 이벤트 2건 추가 필요:
  - `inventory.stock-changed` | `inventory` | `product` | 인-프로세스 EventEmitter
    (ProductEventsHandler — ACTIVE↔OUT_OF_STOCK 상태 자동 전이, FR-023·024, ADR-004·014)
  - `product.viewed` | `product` | `user` | 인-프로세스 EventEmitter
    (UserEventsHandler — 최근 본 상품 기록, FR-009, ADR-002)

  **§5 도메인 용어 사전 — 신규 핵심 개념 추가**:
  신규 추가 권고 용어 3건:
  - `cross-schema 참조`: users·products 스키마 경계를 넘는 외래키 대신 plain String ID 를 사용하는 패턴
    (P-001·ADR-001). 예: Wishlist.productId, Product.sellerId.
  - `append-only`: 레코드 생성만 허용하고 UPDATE·DELETE 를 메서드 수준에서 제거한 로그 테이블 패턴
    (FR-032·SC-043). 예: inventory_logs 테이블.
  - `cursor 페이지네이션`: OFFSET 대신 마지막 항목의 id 를 cursor 로 사용하는 무한 스크롤형 목록 패턴
    (ADR-007·NFR-001). productId 기반 커서.

- **코드 검증 (PROC-002)**:
  - `apps/backend/prisma/schema.prisma`: sellers/addresses/wishlists/product_views (users schema),
    categories/products/product_images/variants/inventory/inventory_logs (products schema) 존재 확인.
    options 모델 없음 확인 — Variant 가 optionName·optionValue 인라인 필드로 보유.
  - `apps/backend/src/modules/inventory/inventory.service.ts` (emitStockChanged): 
    `this.eventEmitter.emit('inventory.stock-changed', event)` 확인
  - `apps/backend/src/modules/product/product.events.ts`: 
    `@OnEvent('inventory.stock-changed')` ProductEventsHandler 확인
  - `apps/backend/src/modules/product/product.service.ts` (getDetail):
    `this.eventEmitter.emit('product.viewed', { userId: user.userId, productId })` 확인
  - `apps/backend/src/modules/user/user.events.ts`:
    `@OnEvent('product.viewed')` UserEventsHandler 확인
  - `apps/backend/src/modules/inventory/inventory.repository.ts`: update/delete 메서드 없음 확인

- **갱신 권고**:
  - `context.md §4`: "v1.0.0 실재 상태" 주석 → 12개 테이블 실체화로 갱신.
    products 스키마 목록에서 `options` 제거 (실제 미존재, Variant 인라인 흡수).
  - `context.md §3.2`: 이벤트 흐름 표에 inventory.stock-changed·product.viewed 행 추가.
  - `context.md §5`: cross-schema 참조, append-only, cursor 페이지네이션 용어 추가.

- **블로킹 여부**: 비블로킹. Retrospective Agent 처리 위임.

---

## GAP-004

- **유형**: 보안-취약점 / 권한 상승
- **출처**: Security Agent
- **컨텍스트**: [SEC-001: Seller 자가 승인 권한 상승] `seller.controller.ts` L58–71
- **상태**: **RESOLVED by Security Agent** (2026-06-28 20:34)
- **내용**:
  `PATCH /sellers/:id/approve` 및 `PATCH /sellers/:id/reject` 엔드포인트에 admin role 검증 없음.
  JWT 인증된 임의 사용자가 본인의 seller ID로 자가 승인 가능(2단계 공격).
  OWASP A01 Broken Access Control — CVSS 3.1 약 7.7 (High).

  ASM-005에 설계 타협으로 문서화되어 있으나, 자가 승인이 trivially 가능하여 High로 분류.

- **해소 내용**: `admin.guard.ts` (ADMIN_USER_IDS 환경변수 기반, fail-closed) 구현.
  `seller.controller.ts` approve/reject 양쪽에 `@UseGuards(AdminGuard)` 적용.
  `admin.guard.spec.ts` 회귀 테스트 3건 추가. 101 테스트 PASS 확인.
- **블로킹 여부**: 해소됨 — Security Agent status: COMPLETE.

---

## GAP-005

- **유형**: 보안-취약점 / IDOR
- **출처**: Security Agent
- **컨텍스트**: [SEC-002: Inventory 재고 입고 소유권 미검증] `inventory.controller.ts` L29–37
- **상태**: OPEN
- **내용**:
  `POST /inventory/:variantId/stock-in`이 APPROVED 판매자 여부만 확인하고 variantId 소유권을 검증하지 않음.
  임의 APPROVED 판매자가 경쟁사 상품의 재고를 증가시켜 product 상태(OUT_OF_STOCK→ACTIVE) 조작 가능.
  OWASP A01 Broken Access Control — Medium.

- **수정 방향**: stockIn 호출 전 variantId→productId→sellerId 체인으로 소유권 검증 추가.
- **블로킹 여부**: 비블로킹. 후속 패치 spec 또는 003-commerce 이전 수정 권고.
