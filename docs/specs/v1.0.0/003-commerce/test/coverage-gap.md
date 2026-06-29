---
작성: Test Agent (EXECUTION)
버전: v1.0
최종 수정: 2026-06-29 00:14
상태: 확정
---

# Coverage Gap: 003-commerce

## 목차

- [미커버 항목 분류](#미커버-항목-분류)
- [후속 조치 안내](#후속-조치-안내)

---

## 미커버 항목 분류

단위 테스트로 완전히 검증되지 않은 항목.

| SC-ID | 미커버 시나리오 | 카테고리 | 검증 방법 | 환경/도구 | 담당 | 비고 |
|---|---|---|---|---|---|---|
| SC-045 | POST /orders 100회 P95 ≤ 1,000ms 실측 | (3) 운영 환경 권장 | `DATABASE_URL=... TEST_JWT_TOKEN=... pnpm test:e2e --testPathPattern=orders.e2e` | docker-compose (PostgreSQL + backend) | 운영/QA | 인증·입력 검증 structural은 PASS; P95 부하 측정 부분만 skip |
| SC-046 | POST /payments 100회 P95 ≤ 2,000ms 실측 | (3) 운영 환경 권장 | `DATABASE_URL=... TEST_JWT_TOKEN=... TEST_ORDER_ID=... pnpm test:e2e --testPathPattern=payments.e2e` | docker-compose (PostgreSQL + backend) | 운영/QA | 인증·입력 검증 structural은 PASS; P95 부하 측정 부분만 skip |

> 카테고리 (1) 항목 0건 — Development Agent 복귀 불필요 (coverage gap 기준).
> 카테고리 (2)(3) 만 존재 — 사용자/운영자 위임 후 Docs Agent 진행 가능.
>
> 단, SC-011 [A] 구현 오류로 `status: BLOCKED`. SC-011은 coverage gap이 아닌
> 구현 오류이며 `test-report.md` 실패 목록에 기록.

---

## 후속 조치 안내

**SC-045, SC-046 검증 절차**:

```bash
# 1. docker-compose 환경 기동
docker compose up -d

# 2. 테스트 JWT 토큰 발급 (인증 서비스에서 테스트 사용자 로그인)
# 예: POST /auth/login → JWT 발급

# 3. SC-045 (orders P95)
DATABASE_URL=postgresql://... \
TEST_JWT_TOKEN=eyJ... \
pnpm --filter backend test:e2e -- --testPathPattern=orders.e2e

# 4. SC-046 (payments P95)
DATABASE_URL=postgresql://... \
TEST_JWT_TOKEN=eyJ... \
TEST_ORDER_ID=<생성된 주문 ID> \
pnpm --filter backend test:e2e -- --testPathPattern=payments.e2e
```
