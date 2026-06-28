---
작성: Planning Agent
버전: v1.0
최종 수정: 2026-06-28
상태: 검토중
---

# selection-phases.md

## 목차

- [선택 단계 활성화 결정](#선택-단계-활성화-결정)
- [신규 의존성 자가 점검 (PATCH-A15)](#신규-의존성-자가-점검-patch-a15)
- [활성화된 단계 실행 순서](#활성화된-단계-실행-순서)

---

## 선택 단계 활성화 결정

> 활성화 기준: spec.md 의 FR/NFR 에 **명시적** 요구사항이 존재할 때만 Y. 암묵적 연관은 활성화하지 않음.

| Agent | 결정 | 근거 |
|---|---|---|
| Database Design Agent | **Y** | FR-004(8개 스키마 네임스페이스 선언), FR-005(users 스키마 User·RefreshToken 테이블 정의), FR-006(Prisma migrate 적용) — DB 스키마·테이블 생성이 **명시**됨. multiSchema 마이그레이션 설계 검토 가치 존재. |
| Deploy Agent | **Y** | FR-014(멀티스테이지 Dockerfile, docker build 성공), FR-015(GitHub Actions CI lint→typecheck→test→docker build 단계 차단) — 컨테이너화 + CI/CD 변경이 **명시**됨. SC-022/023/024/025/026 가 빌드·CI 검증 대상. 단, 실제 Fly.io 배포(flyctl deploy)는 범위 외(ASM-001)이므로 검증 범위는 Dockerfile 구조 + CI workflow `needs` 체인 정합성에 한정. |
| Security Agent | **Y** | FR-008~013(JWT 인증·인가, register/login/refresh/logout/me, JwtAuthGuard), NFR-005(비밀번호 단방향 해싱·원문 미저장) — 인증·인가 및 보안 요구사항이 **명시**됨. JWT 토큰 수명·refresh 저장 형태(평문 vs 해시)·bcrypt cost 검토 가치 존재. |
| Performance Agent | **Y** | NFR-001(GET /health P95 200ms 이내), NFR-002(/auth/* P95 500ms 이내) — 성능 목표 **수치**가 명시됨(연속 50회 측정 조건 포함). SC-008/SC-027 이 성능 검증 대상. |

> 4개 모두 Y 는 over-activation 이 아니라, 본 spec 이 DB 스키마·컨테이너화/CI·인증보안·성능수치 4개 영역 모두에서 **명시적 요구사항**을 보유하기 때문이다. 활성화 강도가 부담되면 main session 이 Plan Mode 에서 사용자와 범위(예: skeleton 단계 한정 경량 검토)를 조정한다.

---

## 신규 의존성 자가 점검 (PATCH-A15)

> 본 항목은 신규 PyPI 의존성 점검 규약이나, 본 프로젝트는 **Node.js/TypeScript(pnpm)** 스택으로 PyPI 무관.

- 신규 PyPI 의존성: **없음** (Python 프로젝트 아님 → 본 항목 무관).
- 참고(npm 생태계): NestJS·Prisma·@nestjs/jwt·passport-jwt·bcrypt·class-validator·nestjs-pino 등 신규 npm 의존성 추가됨. `[env:e2e-docker]` 태그 SC 는 부재(spec 은 [env:static]/[env:unit]/[env:integration] 사용). docker build(SC-022/026)에서 의존성 설치·import 가능 여부가 정적/빌드 단계로 검증되므로 Deploy Agent(위 Y)가 이를 커버. 별도 정적 갈음 불필요.

---

## 활성화된 단계 실행 순서

```
[3단계 Design 완료]
      ↓
Database Design Agent   (3단계 후 / 4단계 전)
      ↓
[4단계 Development + 5a Test(AUTHORING) = PPG-1 병렬]
      ↓
[5b Test(EXECUTION) → 6단계 Docs]
      ↓
Deploy Agent → Security Agent → Performance Agent   (6단계 후 / 7단계 전, 캐스케이딩 블로킹 규칙 적용)
      ↓
[7단계 Retrospective]
```

- 캐스케이딩 블로킹(agent-rules §0): Deploy 실패 → Security·Performance 스킵 / Security Critical·High 블로킹 → Performance 스킵 / Security Medium 이하 COMPLETE → Performance 진행.

결정 일시 및 결정자: 2026-06-28, Planning Agent (2단계).
