---
작성: Docs Agent
버전: v1.0
최종 수정: 2026-06-30 13:56
상태: 확정 (retroactive)
---

# Diff: 011-backend-cors-dev-logging

## 커밋 메시지용 한 줄 요약

- **KO**: feat(backend): CORS 활성화 + pino-pretty dev 로깅 의존성 보강
- **EN**: feat(backend): enable CORS + add pino-pretty dev logging dependency

## 변경 요약

- **CORS 활성화(FR-001)**: `main.ts` 부트스트랩에 `app.enableCors()` 추가. 허용 origin 은
  `CORS_ORIGIN` 환경변수(콤마 구분)에서 읽고 미설정 시 전체 허용(`true`)으로 fallback,
  `credentials: true`. 콘솔(별도 origin)·로컬 데모 클라이언트의 교차 출처 API 호출을 허용.
- **pino-pretty 의존성 추가(FR-002·FR-003)**: `app.module.ts` 가 비프로덕션에서 사용하는
  `transport: { target: 'pino-pretty' }` 의 누락 의존성을 `devDependencies` 에 추가
  (`^13.1.3`)하고 `pnpm-lock.yaml` 에 전이 의존성 트리 반영. 비프로덕션 부팅 시 transport 로드
  실패 잠재 결함 해소.
- **`CORS_ORIGIN` 환경변수 문서화(GAP-011-01 해소)**: `apps/backend/.env.example` 에 `CORS_ORIGIN`
  항목을 fail-open 주의 주석과 함께 추가. 프로젝트 `infra.md` §7 배포 전 체크리스트에 `CORS_ORIGIN`
  Fly secret 설정 항목, §8 알려진 제약에 CORS fail-open 기본값 행 추가(별도 추적).

## 변경 파일 및 라인 수

| 파일 | 추가 | 삭제 |
|---|---|---|
| `apps/backend/src/main.ts` | 7 | 0 |
| `apps/backend/.env.example` | 3 | 0 |
| `apps/backend/package.json` | 1 | 0 |
| `pnpm-lock.yaml` | 82 | 0 |

> 정확한 라인 카운트: `git diff --numstat 1fe3489 -- apps/backend/src/main.ts apps/backend/.env.example apps/backend/package.json pnpm-lock.yaml`
>
> 프로젝트 메타 문서 `.claude/docs/infra.md`(+2)는 인프라 참조 문서로 spec 산출물과 별도 추적한다.

## Diff

> 전체 diff 는 박제하지 않는다 — git 이 형상관리 SoT.
> base commit + 재생성 명령만 기록:
> `git diff 1fe3489 -- apps/backend/src/main.ts apps/backend/.env.example apps/backend/package.json pnpm-lock.yaml`
>
> 주의: 본 변경은 작성 시점에 **미커밋(working tree)** 상태였다. 커밋 후에는 위 base 를
> 해당 spec 의 실제 커밋 직전 해시로 갱신한다.
