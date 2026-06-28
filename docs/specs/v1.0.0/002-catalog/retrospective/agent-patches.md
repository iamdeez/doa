---
작성: Retrospective Agent
버전: v1.0
최종 수정: 2026-06-28
상태: 검토중
---

# Agent Patches: 002-catalog

> 적용 주체 = main session (사용자 승인 후). 본 Agent 는 제안만 한다.

## 목차

- [PATCH-001 — 권한 부여·승인 엔드포인트 권한 상승 사전 평가](#patch-001--권한-부여승인-엔드포인트-권한-상승-사전-평가)
- [context.md / infra.md 갱신 패치 (PATCH-CXT)](#contextmd--inframd-갱신-패치-patch-cxt)

---

## PATCH-001 — 권한 부여·승인 엔드포인트 권한 상승 사전 평가

- **대상 파일**: `~/.claude/agents/01-spec.md`, `~/.claude/agents/02-planning.md`
- **대상 섹션**: 01-spec.md 의 가정(ASM) 도출 절차 / 02-planning.md 의 인터페이스 계약·설계 검토 절차
- **현재 내용**: 권한 관련 엔드포인트의 권한 모델을 별도 사전 평가하는 명시 체크가 없다. ASM-005 처럼 "RBAC 후속" 타협을 *문서화* 할 수 있으나, 그 타협이 **권한 상승(자가 승인·타인 자원 조작) 위험을 수용 가능 수준으로 낮추는지** 를 평가하는 항목이 부재.
- **변경 내용**: 다음 경량 체크를 추가한다.
  - [01-spec.md] 가정·요구사항 도출 시: "상태 부여·승인·거부·소유권 전이 엔드포인트(approve/reject/publish/transfer 등)에 대해, 호출자가 자기 자신 또는 타인의 자원에 권한을 trivially 부여·조작할 수 있는가? 그렇다면 해당 위험을 ASM 으로 *수용* 하기 전에 [NEEDS CLARIFICATION] 또는 명시적 위험 평가를 남긴다."
  - [02-planning.md] 인터페이스 계약 작성 시: "권한 부여/상태 전이 엔드포인트마다 (a) 호출자 신원, (b) 대상 자원 소유권, (c) 역할(admin 등) 3축 중 무엇을 검증하는지 표로 명시한다. 미검증 축이 있으면 그 위험과 후속 처리(또는 본 spec 내 완화)를 plan 에 기재한다."
- **변경 근거**: OBS-1, GAP-004 (SEC-001 High — seller 자가 승인). ASM-005 가 위험을 문서화했으나 평가하지 않아 Security 단계까지 식별이 지연되고 약 1시간 복귀 캐스케이드(4→5b→6→Security→Performance)가 발생.
- **적합성**: 범용 O (모든 도메인의 권한 모델에 적용, 언어·OS 불문) / 역할정합 O (Spec=가정 도출, Planning=인터페이스 계약 — 양 Agent 의 본래 책임 범위 내).

---

## context.md / infra.md 갱신 패치 (PATCH-CXT)

> [MUST NOT] Retrospective Agent 가 직접 수정하지 않는다. main session 이 사용자 확인 후 적용.

### PATCH-CXT-001: context.md §1 — 모듈 구현 상태 주석 현행화

- 대상 파일: `/Users/krystal/workspace/doa/doa-next/.claude/docs/context.md`
- 대상 섹션: §1 프로젝트 개요 (L20~22 설명 주석)
- 변경 내용: `apps/backend`(NestJS 18모듈 — auth 실구현 + 17 스텁) → `apps/backend`(NestJS 18모듈 — auth·user·seller·product·inventory 5개 실구현 + 13 스텁). 검증 문구는 본 차수 코드 상태에 맞게 유지(101 테스트 PASS 는 002 결과이며 §1 은 골격 검증 문맥 — "검증(32/32 테스트 PASS) 완료" 는 001 골격 시점 사실이므로 보존하되, 5모듈 실구현 사실만 반영).
- 변경 근거: GAP-002 §1
- 코드 검증 (PROC-002): `apps/backend/src/modules/{user,seller,product,inventory}/*.service.ts` 4개 모듈 실구현 존재 확인(grep — service/controller/repository/events 채워짐). auth 포함 5개 실구현.

### PATCH-CXT-002: context.md §2 — 도메인 모듈 구현 상태 + OptionalJwtAuthGuard

- 대상 파일: 동일 context.md
- 대상 섹션: §2 핵심 도메인 모듈 목록 하단 주석(L91~92) + 공통(shared)·인프라 모듈 표 `shared/auth` 행(L99)
- 변경 내용:
  - 하단 주석: "`auth` 만 실구현. 나머지 17개(user~admin)는 4계층 빈 스텁" → "`auth`·`user`·`seller`·`product`·`inventory` 5개 실구현(controller/service/repository/events/dto). 나머지 13개(cart~admin)는 4계층 빈 스텁(Stage 3 대상)."
  - `shared/auth` 행 역할: "JwtStrategy · JwtAuthGuard · `@CurrentUser` 데코레이터" → "JwtStrategy · JwtAuthGuard · OptionalJwtAuthGuard · AdminGuard(ADMIN_USER_IDS env 기반, fail-closed) · `@CurrentUser` 데코레이터"
- 변경 근거: GAP-002 §2 + GAP-004 해소(AdminGuard 신규 — GAP-002 작성 시점 미반영분 보정)
- 코드 검증 (PROC-002): `shared/auth/optional-jwt-auth.guard.ts`·`auth-shared.module.ts`(OptionalJwtAuthGuard export), `shared/auth/admin.guard.ts`(ADMIN_USER_IDS·fail-closed) 존재 확인. user/seller/product/inventory 4모듈 실구현 확인.

### PATCH-CXT-003: context.md §6 — 빈 스텁 수 + 신규 제약

- 대상 파일: 동일 context.md
- 대상 섹션: §6 알려진 제약 및 기술 부채 (L216 "17개 도메인 모듈 빈 스텁" 행)
- 변경 내용:
  1. "17개 도메인 모듈 빈 스텁 | auth 외 17개 모듈(user~admin)…" → "13개 도메인 모듈 빈 스텁 | auth·user·seller·product·inventory 외 13개 모듈(cart~admin)은 4계층 골격만 존재 | 해당 모듈 | Stage 3"
  2. 신규 행: "inventory 재고 입고 소유권 미검증 (SEC-002/IDOR) | `POST /inventory/:variantId/stock-in` 이 APPROVED 여부만 확인, variantId→product→seller 소유권 미검증. 임의 APPROVED 판매자가 타 상품 재고·상태(OUT_OF_STOCK↔ACTIVE) 조작 가능 | `inventory`·`product` 모듈 | GAP-005 — 003-commerce 이전 수정 권고"
  3. 신규 행: "cross-schema plain String 참조 제약 (P-001·ADR-001) | users·products 스키마 간 외래키 없음. Wishlist.productId·ProductView.productId·Product.sellerId·InventoryLog.variantId/productId 는 plain String 으로 상대 스키마 참조. DB 수준 참조 무결성 없음(의도적), 삭제 시 고아 레코드 가능 | users·products 스키마 | 002-catalog"
  - 주의(PROC-002 보정): GAP-002 가 권고한 "admin RBAC 미구현 (ASM-005)" 신규 제약은 **등재하지 않는다**. GAP-002 작성(19:21) 이후 SEC-001 이 해소(20:34, AdminGuard 적용)되어 seller approve/reject 는 ADMIN_USER_IDS 기반 권한 검증이 적용됨. admin 권한은 RBAC 테이블이 아닌 env 화이트리스트 방식이라는 사실은 §2 shared/auth 행(PATCH-CXT-002)에 반영하는 것으로 충분.
- 변경 근거: GAP-002 §6 + GAP-005 + GAP-004 해소 보정
- 코드 검증 (PROC-002): seller.controller.ts L62·L72 `@UseGuards(AdminGuard)` 확인(자가 승인 차단). inventory.controller.ts stock-in 소유권 미검증(security-report SEC-002). schema.prisma plain String 참조 확인.

### PATCH-CXT-004: context.md §4 — 12 테이블 실체화 + options 제거

- 대상 파일: 동일 context.md
- 대상 섹션: §4 데이터 모델 — 스키마 분리 구조(L175 products 행) + "v1.0.0 실재 상태" 주석(L183~186)
- 변경 내용:
  - products 스키마 목록: `(categories, products, product_images, options, variants, inventory, inventory_logs)` → `(categories, products, product_images, variants, inventory, inventory_logs)` (`options` 제거 — Variant 가 optionName·optionValue 인라인 필드로 흡수)
  - "v1.0.0 실재 상태" 주석: "`users` 스키마에 `users`·`refresh_tokens` 2개 테이블만 실체화" → "`users` 스키마 6테이블(users·refresh_tokens·sellers·addresses·wishlists·product_views) + `products` 스키마 6테이블(categories·products·product_images·variants·inventory·inventory_logs) = 12개 테이블 실체화(Prisma migrate 적용 완료). 나머지 6개 스키마(commerce·orders·payments·settlements·admin·files)는 네임스페이스만 선언(테이블 0)."
- 변경 근거: GAP-003 §4
- 코드 검증 (PROC-002): `schema.prisma` model 헤더 12개 직접 확인 — users 6(User·RefreshToken·Seller·Address·Wishlist·ProductView), products 6(Category·Product·ProductImage·Variant·Inventory·InventoryLog). `options` model 부재 확인.

### PATCH-CXT-005: context.md §3.2 — 002 실구현 이벤트 추가

- 대상 파일: 동일 context.md
- 대상 섹션: §3.2 이벤트 흐름 표 (L125~133)
- 변경 내용: 표에 2행 추가
  - `inventory.stock-changed` | `inventory` | `product` | 인-프로세스 EventEmitter (ProductEventsHandler — ACTIVE↔OUT_OF_STOCK 자동 전이, FR-023·024)
  - `product.viewed` | `product` | `user` | 인-프로세스 EventEmitter (UserEventsHandler — 최근 본 상품 기록, FR-009)
- 변경 근거: GAP-003 §3.2
- 코드 검증 (PROC-002): inventory.service.ts `emit('inventory.stock-changed')`, product.events.ts `@OnEvent('inventory.stock-changed')` ProductEventsHandler, product.service.ts `emit('product.viewed')`, user.events.ts `@OnEvent('product.viewed')` UserEventsHandler — GAP-003 코드 검증 절에서 확인됨(Docs Agent grep + 본 Agent 모델 구조 확인 일치).

### PATCH-CXT-006: context.md §5 — 신규 도메인 용어 3건

- 대상 파일: 동일 context.md
- 대상 섹션: §5 도메인 용어 사전 표
- 변경 내용: 3행 추가
  - `cross-schema 참조` | users·products 스키마 경계를 넘는 외래키 대신 plain String ID 를 사용하는 패턴(P-001·ADR-001) | (금지 동의어) 외래키 참조
  - `append-only` | 레코드 생성만 허용하고 UPDATE·DELETE 를 메서드 수준에서 제거한 로그 테이블 패턴(FR-032·SC-043, 예: inventory_logs) | 불변 로그
  - `cursor 페이지네이션` | OFFSET 대신 마지막 항목 id 를 cursor 로 사용하는 무한 스크롤형 목록 패턴(ADR-007·NFR-001) | 오프셋 페이지네이션
- 변경 근거: GAP-003 §5
- 코드 검증 (PROC-002): inventory.repository.ts update/delete 부재(append-only), product.repository.ts listPublic cursor 기반, schema.prisma plain String 참조 — 확인.

### PATCH-CXT-007: infra.md §7·§8 — ADMIN_USER_IDS 운영 배포 제약

- 대상 파일: `/Users/krystal/workspace/doa/doa-next/.claude/docs/infra.md`
- 대상 섹션: §7 배포 전 확인 체크리스트(L177~) + §8 알려진 인프라 제약
- 변경 내용:
  - §7 체크리스트에 1항목 추가: "[ ] `ADMIN_USER_IDS` Fly secret 설정 확인 (seller 승인/거부 권한. **fail-closed** — 미설정 시 모든 승인 차단)"
  - §8 제약 표에 1행 추가: "AdminGuard fail-closed 권한 | seller approve/reject 는 `ADMIN_USER_IDS` env 화이트리스트로만 인가. 미설정/오설정 시 전원 403(승인 업무 마비 vs 자가 승인 차단의 trade-off) | `seller` 모듈·운영 | 002-catalog (SEC-001 대응)"
  - 주의: env **값** 자체는 기재하지 않는다(infra 작성 원칙 §3.3 — env 는 .env.example SoT). 본 패치는 "운영 배포 시 필수 설정 + fail-closed 동작" 이라는 **운영 제약**만 기재하며, 기존 §7 이 이미 DATABASE_URL·R2_* 를 동일 방식(설정 확인 체크)으로 다루는 컨벤션과 일치.
- 변경 근거: security-report.md REC-001 ("운영 배포 전 ADMIN_USER_IDS 반드시 설정"), GAP-004 해소
- 코드 검증 (PROC-002): admin.guard.ts `process.env['ADMIN_USER_IDS']` 기반·`adminIds.length === 0 → ForbiddenException`(fail-closed) 확인. .env.example ADMIN_USER_IDS 추가됨(pipeline-log 20:20).
