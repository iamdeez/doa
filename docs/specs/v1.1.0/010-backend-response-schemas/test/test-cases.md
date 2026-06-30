---
작성: Docs Agent
버전: v1.0
최종 수정: 2026-06-30 03:37
상태: 확정 (retroactive)
---

# Test Cases: 010-backend-response-schemas

## 목차

- [SC × 시나리오 매트릭스](#sc--시나리오-매트릭스)
- [시나리오 상세](#시나리오-상세)

> **역문서화 주의**: 이 문서는 구현된 코드(a3fc463→1fe3489)를 기준으로 검증 시나리오를
> 역추출하였다. 런타임 변환이 없는 문서 전용 DTO 스펙이므로 정적 코드 검증과 기존
> 자동화 테스트(Jest) 결과로 SC를 검증한다.

---

## SC × 시나리오 매트릭스

| SC | 시나리오 ID | 시나리오 요약 | 검증 방법 |
|---|---|---|---|
| SC-001 | TC-001 | 14개 DTO 파일 존재 확인 | 정적 (파일 존재) |
| SC-002 | TC-002 | 컨트롤러 @ApiOkResponse 부착 확인 | 정적 (grep) |
| SC-003 | TC-003 | 금전 필드 type: String 선언 확인 | 정적 (grep) |
| SC-004 | TC-004 | openapi:gen 스크립트 NODE_ENV=production 포함 | 정적 (파일 읽기) |
| SC-005 | TC-005 | openapi.json schemas 수 = 73 | 정적 (JSON 파싱) |
| SC-006 | TC-006 | 2xx content 정의 오퍼레이션 수 = 62 / 89 | 정적 (JSON 파싱) |
| SC-007 | TC-007 | openapi.gen.ts 갱신 여부 | 정적 (git diff stat) |
| SC-008 | TC-008 | 백엔드 Jest 261 PASS | 자동화 테스트 |
| SC-009 | TC-009 | wishlist/recent-views DTO productId 전용 | 정적 (코드 분석) |

---

## 시나리오 상세

### TC-001: 14개 DTO 파일 존재 확인

**SC**: SC-001  
**검증 방법**: 정적 파일 존재 확인

```bash
git ls-files apps/backend/src/modules --others --exclude-standard | grep 'response.dto.ts'
# 또는
ls apps/backend/src/modules/*/dto/*-response.dto.ts
```

**기대 결과**: 아래 14개 파일이 존재한다.

```
apps/backend/src/modules/admin/dto/admin-response.dto.ts
apps/backend/src/modules/auth/dto/auth-response.dto.ts
apps/backend/src/modules/banner/dto/banner-response.dto.ts
apps/backend/src/modules/cart/dto/cart-response.dto.ts
apps/backend/src/modules/coupon/dto/coupon-response.dto.ts
apps/backend/src/modules/notification/dto/notification-response.dto.ts
apps/backend/src/modules/order/dto/order-response.dto.ts
apps/backend/src/modules/product/dto/product-response.dto.ts
apps/backend/src/modules/review/dto/review-response.dto.ts
apps/backend/src/modules/seller/dto/seller-response.dto.ts
apps/backend/src/modules/settlement/dto/settlement-response.dto.ts
apps/backend/src/modules/shipping/dto/shipping-response.dto.ts
apps/backend/src/modules/stats/dto/stats-response.dto.ts
apps/backend/src/modules/user/dto/user-response.dto.ts
```

---

### TC-002: 컨트롤러 @ApiOkResponse 부착 확인

**SC**: SC-002  
**검증 방법**: 정적 코드 분석 (grep)

```bash
grep -l "@ApiOkResponse" apps/backend/src/modules/**/*.controller.ts
```

**기대 결과**: 14개 컨트롤러 파일에서 `@ApiOkResponse` 가 확인된다.
(admin, auth, banner, cart, coupon, notification, order, product, review, search,
settlement, shipping, stats, user)

---

### TC-003: 금전 필드 type: String 선언 확인

**SC**: SC-003  
**검증 방법**: 정적 코드 분석 (grep)

```bash
grep -r "P-005" apps/backend/src/modules/*/dto/*-response.dto.ts
```

**기대 결과**: 금전 필드가 있는 DTO(order, product, coupon, cart, settlement, stats, review)
에서 `P-005` 주석이 포함된 `@ApiProperty({ type: String, … })` 선언이 확인된다.

---

### TC-004: openapi:gen 스크립트 bug fix 확인

**SC**: SC-004  
**검증 방법**: 정적 파일 읽기

```bash
grep "openapi:gen" apps/backend/package.json
```

**기대 결과**:
```
"openapi:gen": "nest build && NODE_ENV=production node dist/openapi.js"
```

---

### TC-005: openapi.json schemas 수 = 73

**SC**: SC-005  
**검증 방법**: JSON 파싱

```bash
python3 -c "
import json
with open('apps/backend/openapi.json') as f:
    d = json.load(f)
schemas = d.get('components', {}).get('schemas', {})
print(len(schemas))
"
```

**기대 결과**: `73`

---

### TC-006: 2xx content 정의 오퍼레이션 수 = 62 / 89

**SC**: SC-006  
**검증 방법**: JSON 파싱

```bash
python3 -c "
import json
with open('apps/backend/openapi.json') as f:
    d = json.load(f)
total = covered = 0
for path, methods in d.get('paths', {}).items():
    for method, op in methods.items():
        if method in ('get','post','put','patch','delete'):
            total += 1
            responses = op.get('responses', {})
            for code, resp in responses.items():
                if str(code).startswith('2') and resp.get('content'):
                    covered += 1
                    break
print(f'{covered}/{total}')
"
```

**기대 결과**: `62/89`

---

### TC-007: openapi.gen.ts 갱신 여부

**SC**: SC-007  
**검증 방법**: git diff stat

```bash
git diff --stat a3fc463 1fe3489 -- packages/shared-types/src/openapi.gen.ts
```

**기대 결과**: `+562, -61` 수준의 변경이 확인된다.

---

### TC-008: 백엔드 Jest 261 PASS

**SC**: SC-008  
**검증 방법**: 자동화 테스트 실행

```bash
pnpm --filter backend test
```

**기대 결과**: `Test Suites: N passed, N total` / `Tests: 261 passed, 261 total`

---

### TC-009: wishlist/recent-views DTO productId 전용

**SC**: SC-009  
**검증 방법**: 정적 코드 분석

```bash
grep -A 5 "WishlistItemResponse\|RecentViewItemResponse" \
  apps/backend/src/modules/user/dto/user-response.dto.ts
```

**기대 결과**: `WishlistItemResponse`, `RecentViewItemResponse` 클래스에 `productId` 필드만
존재하며 `title`, `price`, `images` 등 상품 상세 필드가 없다.
