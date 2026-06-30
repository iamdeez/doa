---
작성: Docs Agent
버전: v1.0
최종 수정: 2026-06-30 03:37
상태: 확정 (retroactive)
---

# Spec Input: 010-backend-response-schemas

## 목차

- [요구사항 원문 재구성](#요구사항-원문-재구성)
- [선행 맥락](#선행-맥락)

> **역문서화 주의**: 이 문서는 실제 구현 커밋(a3fc463→1fe3489)에서 의도를 역추출한 것이다.
> 당시 사용자 요청을 있는 그대로 재구성하되, 확인 불가능한 세부 문구는 코드에서 추론하였다.

---

## 요구사항 원문 재구성

> **배경**: GAP-001-01 — 백엔드 컨트롤러에 `@ApiResponse` type 어노테이션이 없어
> OpenAPI 사양서의 응답 스키마가 0건이었다. 프론트엔드 codegen 타입이 `unknown` 으로
> 생성되어 타입 안전성 확보가 불가능한 상황이었다.

**요구사항 (재구성)**:

1. 백엔드 모든 도메인 컨트롤러에 OpenAPI 응답 스키마를 추가하라.
2. 런타임 변경 없이 문서 전용 DTO 클래스로 구현하라(컨트롤러 반환 타입 변경 없음).
3. Prisma Decimal 금전 필드는 JSON 직렬화 시 string이 되므로 DTO에서 `type: String`으로
   선언하라.
4. `openapi:gen` 스크립트가 동작하지 않는 버그(NODE_ENV 미설정 → pino-pretty silent exit)를
   함께 수정하라.
5. 코드 생성 후 `openapi.json` 과 `openapi.gen.ts` 를 커밋에 포함하라.

---

## 선행 맥락

| 항목 | 내용 |
|---|---|
| 선행 spec | 007-backend-foundation (백엔드 모듈 기반 구현) |
| 근거 GAP | GAP-001-01 — OpenAPI 응답 스키마 0건 |
| 제약 P-001 | user → product 모듈 단방향 의존 경계 — wishlist/recent-views는 productId만 반환 |
| 제약 P-005 | Prisma Decimal → JSON string 직렬화 — 모든 금전 필드 `type: String` |
| 관련 파이프라인 | `pnpm --filter backend openapi:gen` → `pnpm --filter @doa/shared-types gen` |
