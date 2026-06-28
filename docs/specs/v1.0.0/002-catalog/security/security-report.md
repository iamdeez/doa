---
작성: Security Agent
버전: v1.1
최종 수정: 2026-06-28 20:34
상태: 확정
---

# 보안 감사 결과 — 002-catalog

## 목차

- [검토 범위](#검토-범위)
- [요약](#요약)
- [Constitution 보안 조항 이행 현황](#constitution-보안-조항-이행-현황)
- [취약점 목록](#취약점-목록)
- [NFR 보안 요구사항 이행 현황](#nfr-보안-요구사항-이행-현황)
- [권고사항](#권고사항)

---

## 검토 범위

### 검토 대상 파일 (DIFF-002-catalog.md v1.1 기반)

| 파일 | 검토 이유 |
|---|---|
| `apps/backend/src/shared/auth/admin.guard.ts` | SEC-001 수정 — fail-closed AdminGuard 구현 검증 |
| `apps/backend/src/shared/auth/admin.guard.spec.ts` | SEC-001 회귀 방지 테스트 3건 검증 |
| `apps/backend/src/modules/seller/seller.controller.ts` | SEC-001 수정 — approve/reject AdminGuard 적용 확인 |
| `apps/backend/src/modules/seller/seller.service.ts` | approve/reject 비즈니스 로직 |
| `apps/backend/src/modules/seller/dto/register-seller.dto.ts` | 입력 검증 |
| `apps/backend/src/modules/seller/dto/reject-seller.dto.ts` | 입력 검증 |
| `apps/backend/src/modules/product/product.controller.ts` | FR-020 소유권 엔드포인트 |
| `apps/backend/src/modules/product/product.service.ts` | assertOwner 소유권 검증 로직 |
| `apps/backend/src/modules/product/dto/create-product.dto.ts` | 입력 검증 |
| `apps/backend/src/modules/product/dto/list-products.dto.ts` | 입력 검증 |
| `apps/backend/src/modules/inventory/inventory.controller.ts` | 재고 접근 제어 |
| `apps/backend/src/modules/inventory/inventory.service.ts` | 재고 차감 원자성 |
| `apps/backend/src/modules/inventory/dto/stock-in.dto.ts` | 입력 검증 |
| `apps/backend/src/modules/user/user.controller.ts` | PII 엔드포인트 인증 |
| `apps/backend/src/modules/user/user.service.ts` | PII 응답 필드 확인 |
| `apps/backend/src/modules/user/dto/create-address.dto.ts` | PII 입력 검증 |
| `apps/backend/prisma/schema.prisma` | 스키마 경계·필드 타입 |
| `apps/backend/test/static/auth-required-guards.spec.ts` | NFR-002 가드 정적 검증 |
| `apps/backend/test/static/cross-schema.spec.ts` | NFR-003 모듈 경계 정적 검증 |

### 제외 파일 및 사유

| 파일 | 사유 |
|---|---|
| `user.repository.ts`, `seller.repository.ts`, `product.repository.ts`, `inventory.repository.ts` | cross-schema.spec.ts 정적 테스트가 교차 쿼리 0건 검증. 서비스 레이어 검토로 DB 접근 패턴 확인 완료 |
| `shared/auth/jwt-auth.guard.ts`, `optional-jwt-auth.guard.ts` | auth-required-guards.spec.ts 정적 테스트가 JwtAuthGuard 적용 검증. guard 자체 구현 취약점은 001 범위 |
| `product.events.ts`, `user.events.ts`, `inventory.events.ts` | 이벤트 핸들러 — 이벤트 발행/수신 로직. 인증·권한과 무관한 내부 도메인 이벤트 |

---

## 요약

| 항목 | 수치 |
|---|---|
| 검토 대상 파일 | 19개 (v1.1: admin.guard.ts·admin.guard.spec.ts 추가) |
| Critical 건수 | 0 |
| High 건수 | 0 (SEC-001 RESOLVED) |
| Medium 건수 | 2 |
| Low 건수 | 2 |
| 전체 취약점 건수 | 4 (활성) |

**결정: COMPLETE** — Critical/High 0건 확인. SEC-001 AdminGuard 적용으로 해소.

> **v1.0 (2026-06-28 19:26)**: BLOCKED — SEC-001 High (Seller 자가 승인 권한 상승) 발견.
> **v1.1 (2026-06-28 20:34)**: COMPLETE — SEC-001 RESOLVED (AdminGuard fail-closed 적용).

---

## Constitution 보안 조항 이행 현황

| 조항 | 이행 여부 | 비고 |
|---|---|---|
| P-001 모듈 경계 원칙 (cross-schema 직접 참조 금지) | 이행 | cross-schema.spec.ts(SC-049) 정적 테스트 존재. 4개 모듈 Repository 모두 자기 스키마만 접근 확인 |
| P-002 AWS 의존 금지 원칙 | 이행 | package-no-aws.spec.ts 정적 테스트 존재. DIFF v1.1에서 AWS SDK 신규 의존 없음 확인 |
| P-003 단일 DB 원칙 | 이행 | 단일 PostgreSQL 멀티 스키마. 외부 캐시·브로커 추가 없음 |
| P-004 클라우드 중립 원칙 | 이행 | Fly.io 전용 API 의존 없음 |
| P-005 결제·정산 정합성 원칙 | 해당 없음 | 002 범위는 카탈로그. 결제 흐름 미포함. Decimal 타입 사용(NFR-004) 확인 |
| P-006 테스트 원칙 | 이행 | 101개 테스트 PASS(DIFF v1.1 기준, +3 admin 회귀). 각 FR-XXX에 SC-XXX 대응 확인 |
| P-007 스펙 범위 원칙 | 이행 | DIFF v1.1 변경 파일이 002 spec 범위 내에 한정됨 |

---

## 취약점 목록

### SEC-001 — Seller 자가 승인 권한 상승 [High → RESOLVED]

| 항목 | 내용 |
|---|---|
| 심각도 | ~~High~~ **RESOLVED** |
| OWASP | A01 Broken Access Control — 권한 상승(Privilege Escalation) |
| 위치 | `seller.controller.ts` (`PATCH /sellers/:id/approve`, `PATCH /sellers/:id/reject`) |
| 관련 spec | FR-015, FR-016, ASM-005 |
| 상태 | **RESOLVED** (v1.1 — AdminGuard 적용, 2026-06-28 20:34) |

**해소 내용**

`admin.guard.ts` (신규): `ADMIN_USER_IDS` 환경변수 기반 fail-closed AdminGuard 구현.

```typescript
// admin.guard.ts — fail-closed 핵심 로직
const raw = process.env['ADMIN_USER_IDS'] ?? '';
const adminIds = raw.split(',').map(id => id.trim()).filter(id => id.length > 0);
if (adminIds.length === 0 || !adminIds.includes(user.userId)) {
  throw new ForbiddenException('Admin access required');
}
```

`seller.controller.ts` (v1.1 수정): approve/reject 양쪽에 `@UseGuards(AdminGuard)` 적용.

**SEC-001 회귀 테스트 3건 (admin.guard.spec.ts)**:
1. `when_non_admin_user_calls_approve_then_403` — 비admin → ForbiddenException ✓
2. `when_admin_user_calls_approve_then_pass` — admin → pass ✓
3. `when_admin_user_ids_empty_then_all_403` — 빈값(미설정) → ForbiddenException (fail-closed) ✓

**이전 공격 흐름 차단 확인**:
- `POST /sellers/register → PATCH /sellers/{id}/approve`: AdminGuard에서 ADMIN_USER_IDS 미포함 시 403 반환 ✓
- ADMIN_USER_IDS 미설정 상태에서도 전원 거부(fail-closed) ✓

---

### SEC-002 — Inventory 재고 입고 소유권 미검증 (IDOR) [Medium]

| 항목 | 내용 |
|---|---|
| 심각도 | **Medium** |
| OWASP | A01 Broken Access Control — IDOR(Insecure Direct Object Reference) |
| 위치 | `inventory.controller.ts` (`POST /inventory/:variantId/stock-in`) |
| 관련 spec | FR-030, SC-041 |
| 상태 | 미수정 |

**설명**

`POST /inventory/:variantId/stock-in` 엔드포인트는 호출자가 APPROVED 판매자인지만 검증하고,
해당 `variantId`가 호출자 소유 상품의 variant인지는 검증하지 않는다.

```typescript
async stockIn(user: AuthenticatedUser, variantId: string, dto: StockInDto) {
  await this.sellerService.getApprovedSeller(user.userId); // APPROVED 여부만 확인
  return this.inventoryService.stockIn(variantId, dto.quantity); // 소유권 미확인
}
```

**공격 시나리오**: APPROVED 판매자 A가 경쟁 판매자 B의 variant UUID를 알면:
- `POST /inventory/{B의-variantId}/stock-in` → B 상품의 재고를 증가
- B 상품이 OUT_OF_STOCK이었다면 → `inventory.stock-changed` 이벤트 → B 상품이 ACTIVE로 전환

`getStock`(`GET /inventory/:variantId/stock`)도 동일하게 소유권 미검증이나, 읽기 전용이므로
integrity 위험은 없고 재고 정보 노출(Medium) 수준.

**수정 방향**

`stockIn` 호출 전 variantId → productId → sellerId 체인을 조회하여 호출자 소유 여부 검증:
```typescript
const variant = await this.productRepository.findVariantById(variantId);
if (!variant) throw new NotFoundException('Variant not found');
const product = await this.productRepository.findById(variant.productId);
await this.assertOwner(user.userId, product.sellerId); // 소유권 확인
```

---

### SEC-003 — PII 필드 응답 로그 마스킹 미검증 [Medium]

| 항목 | 내용 |
|---|---|
| 심각도 | **Medium** |
| OWASP | A09 Security Logging and Monitoring Failures |
| 위치 | `user.controller.ts`, `user.service.ts` (프로필·배송지 API 응답) |
| 관련 spec | NFR-002, FR-001~FR-006 |
| 상태 | 미검증 |

**설명**

사용자 프로필(`GET /users/me`)과 배송지 API 응답에는 PII가 포함된다:
- `UserProfile`: `email`, `name`, `phone`
- `AddressData`: `recipientName`, `phone`, `zipCode`, `address1`, `address2`

DIFF 내 변경 파일 범위에서 HTTP 응답을 로깅하는 미들웨어 또는 인터셉터의 존재가 확인되지 않았다.
만약 전역 로깅 미들웨어가 응답 바디를 기록한다면 PII가 로그에 평문으로 노출된다.

**현황**: `user.service.ts`의 `getProfile`은 `password` 및 `refreshToken` 필드를 응답에서 제외하여
인증 자격 정보 노출은 방지하고 있다. PII 로그 마스킹 여부는 001-skeleton에서 구현된
로깅 레이어에 의존하므로 이 spec 단독으로 검증 불가.

**수정 방향**

- 전역 HTTP 로깅 인터셉터에서 `email`, `phone`, `address*`, `recipientName` 필드를 마스킹
- `NestJS LoggingInterceptor`에서 응답 바디의 민감 필드 키를 `***`로 치환

---

### SEC-004 — 사업자등록번호 형식 검증 부재 [Low]

| 항목 | 내용 |
|---|---|
| 심각도 | **Low** |
| OWASP | A03 Injection (입력 검증 미흡) |
| 위치 | `seller/dto/register-seller.dto.ts` (businessNumber 필드) |
| 관련 spec | FR-011, SC-013 |
| 상태 | 미수정 |

**설명**

`RegisterSellerDto.businessNumber`는 `@IsString()`만 적용되어 있어 한국 사업자등록번호(10자리)
형식 검증이 없다. 임의 문자열 입력이 가능하다.

**수정 방향**

```typescript
@IsString()
@Matches(/^\d{10}$/, { message: 'businessNumber must be a 10-digit number' })
businessNumber!: string;
```

---

### SEC-005 — rejectReason 길이 상한 부재 [Low]

| 항목 | 내용 |
|---|---|
| 심각도 | **Low** |
| OWASP | A03 Injection (입력 검증 미흡) |
| 위치 | `seller/dto/reject-seller.dto.ts` (rejectReason 필드) |
| 관련 spec | FR-016, SC-018 |
| 상태 | 미수정 |

**설명**

`RejectSellerDto.rejectReason`은 `@IsString()`만 적용되어 길이 상한이 없다.
극단적으로 긴 문자열이 DB에 저장될 수 있다.

**수정 방향**

```typescript
@IsString()
@MaxLength(1000)
rejectReason!: string;
```

---

## NFR 보안 요구사항 이행 현황

| ID | 요구사항 | 이행 여부 | 비고 |
|---|---|---|---|
| NFR-002 | 인증 필요 엔드포인트 — 무효/없는 JWT → 401 반환 | 이행 | `UserController`·`SellerController`·`InventoryController` 클래스 레벨 `@UseGuards(JwtAuthGuard)`. `auth-required-guards.spec.ts`(SC-048) 정적 검증 존재 |
| NFR-003 | 각 모듈은 자기 스키마 테이블에만 Prisma 직접 접근 | 이행 | `cross-schema.spec.ts`(SC-049) 4개 모듈 Repository 정적 검증. `ProductController.getDetail`은 `OptionalJwtAuthGuard` 적용으로 공개 조회 허용(spec 의도 일치) |
| NFR-004 | 가격 필드 Prisma Decimal 타입 사용 | 이행 | `schema.prisma` Decimal(12,2), `schema-decimal.spec.ts`(SC-047) 정적 검증 |
| NFR-005 | AWS 전용 SDK·서비스 신규 의존 금지 | 이행 | `package-no-aws.spec.ts` 정적 검증 존재. DIFF v1.1 내 AWS 의존 없음 |

---

## 권고사항

### REC-001 (SEC-001 관련 — RESOLVED)

~~`PATCH /sellers/:id/approve`, `PATCH /sellers/:id/reject` 엔드포인트에 `AdminGuard` 적용.~~

**RESOLVED** (2026-06-28 20:34): `admin.guard.ts` 구현 + `seller.controller.ts` `@UseGuards(AdminGuard)` 적용 완료.
ADMIN_USER_IDS 환경변수 설정 필요 (`.env.example` 문서화됨). 운영 배포 전 ADMIN_USER_IDS 반드시 설정할 것.

### REC-002 (SEC-002 관련)

`POST /inventory/:variantId/stock-in` 및 `GET /inventory/:variantId/stock`에 variant 소유권
검증 로직 추가. `InventoryController`에서 `ProductRepository`를 DI 주입하거나
`InventoryService`의 공개 메서드 파라미터로 소유자 검증을 포함하는 방안을 권고한다.
`getStock`은 읽기 전용이므로 우선순위는 `stockIn`이 높다.

### REC-003 (SEC-003 관련)

전역 HTTP 로깅 인터셉터에서 PII 필드(`email`, `phone`, `address1`, `address2`, `recipientName`)
를 마스킹하는 구현을 권고한다. 002 spec 범위 외이므로 003-commerce spec 또는 별도 infra
보안 spec에서 처리 권고.

### REC-004 (SEC-004, SEC-005 관련)

`RegisterSellerDto.businessNumber`에 10자리 숫자 정규식 검증, `RejectSellerDto.rejectReason`에
`@MaxLength(1000)` 추가. 차기 패치 spec에서 처리 가능.
