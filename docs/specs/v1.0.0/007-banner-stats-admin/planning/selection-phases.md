---
작성: Planning Agent
버전: v1.0
최종 수정: 2026-06-29 18:15
상태: 확정 (retroactive)
---

# selection-phases.md

## 목차

- [선택 단계 활성화 결정](#선택-단계-활성화-결정)
- [신규 PyPI/npm 의존성 자가 점검](#신규-pypinpm-의존성-자가-점검)
- [활성화된 단계 실행 순서](#활성화된-단계-실행-순서)
- [결정 일시 및 결정자](#결정-일시-및-결정자)

## 선택 단계 활성화 결정

> 활성화 기준: spec.md FR/NFR 에 **명시적 요구사항**이 존재할 때만 활성화(암묵적 연관 금지).

- **Database Design Agent**: **Y**
  - 근거: FR 에 신규 1테이블(`admin.banners`) + 1 enum(`BannerPosition`) + 노출 조회 인덱스(`(isActive, position, sortOrder)`) 가 명시됨(spec.md FR-001~005, NFR-001). 신규 `admin` 스키마에 배너 테이블 배치. plan.md 데이터 모델 절이 DB Design 입력 contract. SC-011(cross-schema 정적) 검증 대상. stats·admin 은 자체 테이블이 없으나(집계 DI 조합) banner 테이블 1종이 DB Design 을 정당화한다.

- **Deploy Agent**: **N**
  - 근거: FR/NFR 에 배포 환경 구성·컨테이너화·CI/CD 변경 명시 없음. 신규 npm 의존성 0건, Dockerfile/docker-compose 구조 변경 0건. `[env:e2e-docker]` 태그 SC 부재. 신규 env 도입 없음(기존 `ADMIN_USER_IDS`·`DATABASE_URL`·`JWT_*` 재사용). 002~006 동일 로컬 docker-compose + Fly.io 운영.

- **Security Agent**: **Y**
  - 근거: FR/NFR 에 보안 요구 다수 명시 — (1) **인증·인가**: 관리자 엔드포인트 9종 JwtAuthGuard+AdminGuard(fail-closed, NFR-003). (2) **자원 격리**: 판매자 통계 본인 sellerId 격리(`getApprovedSeller`, NFR-004), admin 사용자 목록 민감 필드(password) 제외. (3) **공개 표면**: `GET /banners` 무가드 공개(read-only) 노출 범위. (4) **판매자 승인 병렬 라우트**(OBS-007-01) 권한 표면 감사. 관리자 권한·자원 격리 보안 표면 존재.

- **Performance Agent**: **N**
  - 근거: NFR 에 성능 목표 수치(P95 응답속도·처리량) 명시 없음. 배너 조회는 인덱스, 통계는 도메인 집계로 충족하며 별도 성능 검증 수치 기준 부재. 배너 노출기간 in-memory 필터(GAP-007-02)는 향후 최적화 후보로 기록만 하며 본 spec 의 성능 게이트 대상 아님(MUST NOT 암묵적 활성화).

## 신규 PyPI/npm 의존성 자가 점검

```
자가 점검: 본 spec 에 신규 의존성 추가가 있는가? (package.json dependencies 변경)
  → 없음. 신규 npm 패키지 0건. 기존 Prisma·NestJS·class-validator·@prisma/client 만 사용.
  → 통계 매출 집계는 외부 라이브러리 없이 Prisma.Decimal(@prisma/client 내장) 만 사용.
  → 본 항목 무관. (Deploy Agent 비활성)
```

## 활성화된 단계 실행 순서

- Database Design Agent: 3단계 후 / 4단계 전 (tasks.md 분해 입력으로 data-model.md·마이그레이션 확정)
- Security Agent: 6단계 후 / 7단계 전

> 캐스케이딩 블로킹: Deploy 비활성 → Security 독립 실행. Security BLOCKED(Critical/High) 시 Performance 스킵 — 단 Performance 비활성(N)이므로 무관. 실제 감사 결과 Critical/High 0건(OBS-007-01 Low) → COMPLETE.

## 결정 일시 및 결정자

- 결정 일시: 2026-06-29 18:15
- 결정자: Planning Agent (2단계, retroactive)
