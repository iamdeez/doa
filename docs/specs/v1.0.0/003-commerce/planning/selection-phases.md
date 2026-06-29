---
작성: Planning Agent
버전: v1.0
최종 수정: 2026-06-28
상태: 검토중
---

# selection-phases.md

> 활성화 결정 기준: spec.md 의 FR/NFR 에 명시적 요구사항이 존재할 때만 활성화. 암묵적 연관 활성화 금지.

선택 단계 활성화 결정:

- **Database Design Agent: Y**
  근거: FR-005·010·016·017·028·030~038 + NFR-005/006 이 `commerce`·`orders`·`payments` 스키마에 신규 7테이블(`carts`, `orders`, `order_items`, `order_events`, `payments`, `refunds`, `payment_outbox`) 생성과 `InventoryLogType.RESTORE` enum 확장을 **명시**. 금전 필드 Decimal(NFR-005, SC-049)·cross-schema plain String 경계(NFR-006, SC-050)·append-only(FR-028)·idempotencyKey unique(FR-035/038)·status enum·인덱스(FR-018/024/NFR-001) 등 상세 스키마 설계가 plan.md 데이터 모델 절을 입력으로 `data-model.md`/마이그레이션으로 확정 필요. → **활성화**.

- **Deploy Agent: N**
  근거: 본 spec 은 신규 npm 의존 `pg-boss` 1건을 추가하나 **in-process 부트(`PgBossModule`)로 백엔드 프로세스 내 기동**하며 Dockerfile / docker-compose / fly.toml 구조 변경이 없다. 전용 worker 프로세스 분리·컨테이너화는 후속 인프라 단계로 위임(spec 범위 외). 배포 환경 구성·컨테이너화·CI/CD 변경이 FR/NFR 에 **명시되지 않음**. PATCH-A15 자가 점검 결과(아래) 와 정합. → **비활성화**.

- **Security Agent: Y**
  근거: (1) **결제 정합성**(P-005) — FR-030~038 결제·환불 멱등성·outbox. (2) **IDOR/인가**(NFR-004) — 주문·결제·환불·구매확정·판매자 확인 엔드포인트 소유권 검증(PATCH-001 인가 3축 표). (3) **SEC-002 수정**(FR-050/051) — inventory stock-in/getStock 소유권 검증(IDOR 보정, 선행 spec 결함). (4) 개인정보(배송지 스냅샷·결제 정보) 접근 제어. 인증·인가·결제·보안 요구사항이 FR/NFR 에 **명시**. → **활성화**.

- **Performance Agent: Y**
  근거: NFR-001(`POST /orders` P95 1,000ms)·NFR-002(`POST /payments` P95 2,000ms)에 **성능 목표 수치가 명시**되어 있고 SC-045·046([env:integration])로 검증 대상. 특히 `POST /orders` 는 N variant × (snapshot+checkAvailability+decreaseStock) + order/items/events insert + cart update 를 단일 cross-schema 트랜잭션으로 처리하는 **트랜잭션 집약 hot path** 로, 배치 조회 최적화(PATCH-003)·트랜잭션 라운드트립 수가 P95 에 직접 영향. 명시적 수치 NFR 존재 → 활성화 기준 충족. 검증 범위는 NFR-001/002 의 P95 목표 충족 확인으로 한정. → **활성화**.

활성화된 단계 실행 순서:
1. **Database Design Agent** (3단계 Design 후 / 4단계 Development 전)
2. **Security Agent** (6단계 Docs 후 / 7단계 Retrospective 전)
3. **Performance Agent** (Security 후 — Deploy 비활성이므로 Deploy→Security→Performance 순서에서 Deploy 생략. Security 가 COMPLETE(Medium 이하) 또는 BLOCKED 가 아니면 Performance 진행)

> **캐스케이딩 블로킹 주의**(agent-rules §0): Deploy 비활성 → Security 독립 시작 가능. Security 가 Critical/High 로 BLOCKED 시 Performance 스킵(보안 수정 후 코드 변경으로 성능 최적화 무효화 방지).

결정 일시 및 결정자: 2026-06-28 / Planning Agent (003-commerce 2단계)

---

## 신규 PyPI/npm 의존성 자가 점검 (PATCH-A15)

```
자가 점검: 본 spec 에 신규 패키지 의존성 추가가 있는가? → 있음 (npm: pg-boss 1건)
  - [env:e2e-docker] 태그 SC 존재? → 부재 (모든 SC 가 static/unit/integration)
  - 판정: 신규 의존성 추가만 있고 [env:e2e-docker] 검증 대상 SC 부재
    → Deploy Agent 비활성 가능. pg-boss 는 in-process 부트로 Dockerfile/compose 구조 무변경.
    → "신규 pg-boss 의존성 추가, e2e-docker 검증 대상 아님 (in-process, Docker 빌드 구조 무변경)"
  - 추가 참고: pg-boss 는 비-AWS(P-002 무위반), PostgreSQL 기반 큐로 P-003 이 명시 권장.
```
