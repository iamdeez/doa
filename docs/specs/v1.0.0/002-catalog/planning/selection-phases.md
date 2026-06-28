---
작성: Planning Agent
버전: v1.0
최종 수정: 2026-06-28
상태: 검토중
---

# selection-phases.md

> 활성화 기준: spec.md 의 FR-XXX·NFR-XXX 에 **명시적 요구사항이 존재할 때만** 해당 선택 Agent 를 활성화한다.

## 선택 단계 활성화 결정

- **Database Design Agent**: **Y**
  근거: 본 spec 은 스키마를 대폭 확장한다 — `users` 스키마 신규 4테이블(sellers·addresses·wishlists·product_views) + `User` 모델 확장(name·phone), `products` 스키마 신규 6테이블(categories·products·product_images·variants·inventory·inventory_logs). 컬럼 타입(Decimal·enum), 인덱스(NFR-001 의 products(status,createdAt,id)), 제약(@@unique·cross-schema plain String 경계), 마이그레이션 순서, 카테고리 seed 데이터 설계가 필요하다. plan.md "데이터 모델" 절을 입력 contract 로 `data-model.md` 확정 위임.

- **Deploy Agent**: **N**
  근거: 본 spec 은 순수 비즈니스 로직(REST 핸들러·Prisma 쿼리·인-프로세스 이벤트)으로 Dockerfile / docker-compose / CI workflow 구조를 변경하지 않는다. 신규 npm 의존성 0건(NFR-005·P-002, `package.json` 무변경). 신규 테이블은 기존 `prisma migrate` 메커니즘으로 적용되며 배포 구성 변경이 아니다. `[env:e2e-docker]` 태그 SC 부재.
  > PATCH-A15 신규 의존성 자가 점검: 본 spec 에 신규 PyPI/npm 의존성 추가 **없음**(기존 `@nestjs/event-emitter`·Prisma·JWT 가드 재사용). `[env:e2e-docker]` 태그 SC 부재 → Deploy Agent 비활성. (TS/npm 생태계로 PyPI 무관.)

- **Security Agent**: **Y**
  근거: FR/NFR 에 인증·인가·개인정보 보안 요구사항이 명시되어 있다 — NFR-002(인증 필수 endpoint JWT 401), 개인정보 필드(user `name`·`phone`·`addresses`, seller `businessNumber`), 본인 데이터 접근 제어(FR-004/005 주소 소유 검증, FR-020 상품 소유 검증). 특히 **ASM-005**(seller approve/reject 가 JWT 인증만 요구, admin RBAC 미적용 — 임의 인증 사용자가 판매자 승인/거부 가능)는 권한 상승 위험으로 Security Agent 의 명시적 검토가 필요하다(plan.md 위험 완화 설계 참조). 개인정보 응답 최소화(password 제외, 본인 접근) 검증 포함.

- **Performance Agent**: **Y**
  근거: NFR-001 에 성능 목표 **수치**가 명시되어 있다 — 상품 목록 조회 `GET /products` P95 500ms 이하(로컬 docker-compose, 상품 <1,000개). SC-047 `[env:integration]` 으로 측정 대상. cursor 페이지네이션 + `products(status,createdAt,id)` 인덱스 설계(ADR-007, PATCH-003)의 적정성 검토 위임.

## 활성화된 단계 실행 순서

1. **Database Design Agent** — 3단계(Design) 후 / 4단계(Development) 전. plan.md 데이터 모델 → `data-model.md` + 마이그레이션 설계.
2. (4단계 Development + 5a Test AUTHORING = PPG-1, 5b Test EXECUTION)
3. **Deploy Agent** — 비활성(N), 스킵.
4. **Security Agent** — 6단계(Docs) 후 / 7단계(Retrospective) 전.
5. **Performance Agent** — Security Agent COMPLETE(Medium 이하만) 시 진행. Security 가 Critical/High 로 BLOCKED 시 스킵(캐스케이딩 블로킹 규칙).

> 선택 Agent 실행 순서 규약: Deploy → Security → Performance. Deploy 는 비활성이므로 캐스케이딩 블로킹 대상 아님(비활성은 블로킹 사유 부재).

## 결정 일시 및 결정자

- 결정 일시: 2026-06-28 [시각 미확인]
- 결정자: Planning Agent (2단계)
