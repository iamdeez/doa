---
작성: Planning Agent
버전: v1.0
최종 수정: 2026-06-29
상태: 검토중
---

# selection-phases.md

## 목차

- [선택 단계 활성화 결정](#선택-단계-활성화-결정)
- [신규 PyPI/npm 의존성 자가 점검 (PATCH-A15)](#신규-pypinpm-의존성-자가-점검-patch-a15)
- [활성화된 단계 실행 순서](#활성화된-단계-실행-순서)

## 선택 단계 활성화 결정

> 활성화 기준: spec.md FR/NFR 에 **명시적 요구사항**이 존재할 때만 활성화(암묵적 연관 금지).

- **Database Design Agent**: **Y**
  - 근거: FR 에 commerce 스키마 신규 3테이블(`coupons`·`user_coupons`·`reviews`) + 3 enum + cross-schema plain String 경계·unique 제약(`reviews.orderItemId @unique`, ADR-009)·복합 인덱스(cursor 페이지네이션 FR-025/026)·`issuedCount` 한도 가드(ADR-004)·마이그레이션 순서가 명시됨(spec.md "commerce 스키마에 coupons·user_coupons·reviews 테이블 추가", NFR-001 Decimal). plan.md 데이터 모델 절이 DB Design 입력 contract. SC-050(Decimal 정적)·SC-051(조건부 UPDATE) 검증 대상.

- **Deploy Agent**: **N**
  - 근거: FR/NFR 에 배포 환경 구성·컨테이너화·CI/CD 변경 명시 없음. 신규 npm 의존성 0건, Dockerfile/docker-compose 구조 변경 0건. `[env:e2e-docker]` 태그 SC 부재. 003 동일 로컬 docker-compose + Fly.io 운영(spec-input Q17-19). Prisma 마이그레이션의 Fly release 실행은 운영 영향이나 본 spec 신규 배포 구성 아님(로컬 `prisma migrate dev` 갈음).

- **Security Agent**: **Y**
  - 근거: FR/NFR 에 보안 요구가 다수 명시 — (1) **금전 정합성**: 서버측 할인 계산·클라이언트 discountAmount 차단(FR-010, SEC-FIND-004 재발 방지), 결제 청구액 산출(FR-015). (2) **권한·IDOR**: 쿠폰 사용·발급·리뷰 CRUD 소유권 검증(NFR-004, PATCH-001 평가표, SC-017·032·036·038·053). (3) **이중사용 방지**: 조건부 UPDATE 원자성(NFR-002, FR-013, SC-020). (4) 인증(NFR-003, SC-052). 금전·권한·이중사용 3대 보안 표면 존재.

- **Performance Agent**: **N**
  - 근거: NFR 에 성능 목표 **수치(P95 응답속도·처리량 등)** 명시 없음(spec-input Q15: "특별한 P95 수치 제약 없음"). 리뷰 cursor 페이지네이션은 인덱스 설계(DB Design 담당)로 충족하며 별도 성능 검증 수치 기준 부재. 암묵적 연관으로 활성화하지 않음(MUST NOT).

## 신규 PyPI/npm 의존성 자가 점검 (PATCH-A15)

```
자가 점검: 본 spec 에 신규 의존성 추가가 있는가? (package.json dependencies 변경)
  → 없음. 신규 npm 패키지 0건. 기존 Prisma·NestJS·class-validator·EventEmitter2·@prisma/client(Decimal) 만 사용.
  → 본 항목 무관. (Deploy Agent 비활성, SC-055 가 @aws-sdk 신규 0 정적 검증)
```

## 활성화된 단계 실행 순서

- Database Design Agent: 3단계 후 / 4단계 전 (tasks.md 분해 입력으로 data-model.md·마이그레이션 확정)
- Security Agent: 6단계 후 / 7단계 전

> 캐스케이딩 블로킹: Deploy 비활성 → Security 독립 실행. Security BLOCKED(Critical/High) 시 Performance 스킵 — 단 Performance 비활성(N)이므로 무관.

## 결정 일시 및 결정자

- 결정 일시: 2026-06-29 [시각 미확인]
- 결정자: Planning Agent (2단계)
</content>
