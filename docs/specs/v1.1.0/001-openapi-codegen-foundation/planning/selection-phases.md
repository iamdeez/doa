---
작성: Planning Agent
버전: v1.0
최종 수정: 2026-06-29 22:32
상태: 확정 (retroactive)
---

# selection-phases.md

## 목차

- [선택 단계 활성화 결정](#선택-단계-활성화-결정)
- [신규 PyPI/npm 의존성 자가 점검](#신규-pypinpm-의존성-자가-점검)
- [활성화된 단계 실행 순서](#활성화된-단계-실행-순서)
- [security 폴더 생략 사유](#security-폴더-생략-사유)
- [deploy 후속 노트 (CI 재생성)](#deploy-후속-노트-ci-재생성)
- [결정 일시 및 결정자](#결정-일시-및-결정자)

## 선택 단계 활성화 결정

> 활성화 기준: spec.md FR/NFR 에 **명시적 요구사항**이 존재할 때만 활성화(암묵적 연관 금지).

- **Database Design Agent**: **N**
  - 근거: DB 스키마 변경 0(마이그레이션 없음). 신규 테이블·컬럼·enum·인덱스·제약 0건. 본 차수의 산출은
    런타임 데이터가 아닌 정적 계약 생성물(`openapi.json`·`openapi.gen.ts`)이며, component schemas 32종은
    기존 백엔드 입력 DTO 의 OpenAPI 표현일 뿐 스키마 설계 대상이 아니다.

- **Deploy Agent**: **N**
  - 근거: FR/NFR 에 배포 환경 구성·컨테이너화·CI/CD 변경 명시 없음. `Dockerfile`·`docker-compose`·`env`
    변경 0. 신규 의존(`@nestjs/swagger`·`openapi-typescript`)은 빌드·dev 도구로 런타임 배포 구성에 영향
    없음(`dist/` gitignore). 단 생성물 CI 재생성 검증 자동화는 후속 노트로 기록(아래 §deploy 후속 노트).

- **Security Agent**: **N**
  - 근거: 본 차수는 **빌드 타임 OpenAPI 문서 생성 + 프론트 타입 코드젠**이며, 인증·인가·입력 검증·접근
    제어 표면을 변경하지 않는다. `openapi.ts` 는 listen 없이 부팅 후 즉시 종료(새 런타임 엔드포인트 노출
    0). OpenAPI 의 `addBearerAuth('access-token', http bearer JWT)` 는 기존 JwtAuthGuard 계약의 **문서화**
    일 뿐 인증 로직 변경이 아니다. 생성물은 DTO 형태·검증 제약·설명만 포함하며 민감정보(키·토큰·실데이터)
    노출 0. OWASP Top 10 관점의 신규 공격 표면 부재(plan.md §보안 노트로 갈음).

- **Performance Agent**: **N**
  - 근거: NFR 에 성능 목표 수치(P95·처리량) 명시 없음. 생성기는 빌드 보조 도구로 런타임 핫패스에 위치하지
    않으며 알고리즘·쿼리 변경 0. 생성물 크기(openapi.json 72K·openapi.gen.ts 84K)는 빌드 타임 산출물로
    런타임 성능과 무관.

## 신규 PyPI/npm 의존성 자가 점검

```
자가 점검: 본 spec 에 신규 의존성 추가가 있는가? (package.json dependencies 변경)
  → 있음. 2건:
     - @nestjs/swagger ^11.4.4   (apps/backend dependency — OpenAPI 문서 생성, NestJS 11 호환)
     - openapi-typescript ^7.13.0 (packages/shared-types devDependency — TS 타입 코드젠)
  → 둘 다 AWS/Fly.io 전용 SDK 아님(P-002 무저촉, NFR-004). 빌드·dev 도구이며 런타임 배포 구성·환경변수
    변경 0. Deploy Agent 활성 불요(배포 영향 없음). plan.md Constitution Gates P-002 에 도입 정당화 기록.
```

## 활성화된 단계 실행 순서

- 활성 선택 단계 **없음**(Database Design·Deploy·Security·Performance 전부 N).
- 필수 단계만 진행: Design(3) → Development(4) + Test AUTHORING(5a, PPG-1 병렬) → Test EXECUTION(5b) →
  Docs(6) → Retrospective(7).

> 캐스케이딩 블로킹: 선택 단계 전무로 해당 없음. Design 산출(research·tasks) 후 PPG-1 진입.

## security 폴더 생략 사유

본 spec 폴더에는 `security/` 디렉토리를 생성하지 않는다. Security Agent: N(위 결정 근거 참조 — 빌드 타임
문서 생성·코드젠은 인증·인가·입력 검증·접근 제어 표면을 변경하지 않으며, OpenAPI 의 bearer auth 선언은
기존 계약 문서화일 뿐이고 생성물에 민감정보 노출이 없다). 보안 영향 분석은 본 selection-phases.md 의
Security Agent 결정 근거 + plan.md §보안 노트(노출 표면·인증 스킴 문서화·민감정보 노출·OWASP 결론)로
갈음한다.

## deploy 후속 노트 (CI 재생성)

Deploy Agent 는 비활성(N)이나, 생성물 동기화 관련 후속 운영 항목을 기록한다:

- `openapi.json`·`openapi.gen.ts` 는 생성물이나 편의상 레포에 커밋한다(CI 재생성 가능). 백엔드 DTO 변경
  후 `pnpm --filter backend openapi:gen` → `pnpm --filter @doa/shared-types gen` 양 단계를 재실행해야
  계약이 동기화된다.
- 현재 이 재생성·diff 검증을 CI 에서 자동 수행하지 않는다(사람이 절차 준수). 생성물 drift 방지를 위한
  CI 자동 재생성·diff 0 검증 파이프라인은 후속 권고다(gaps.md GAP-001-01). `dist/` 는 gitignore.

## 결정 일시 및 결정자

- 결정 일시: 2026-06-29 22:32
- 결정자: Planning Agent (2단계, retroactive)
