---
작성: Deploy Agent
버전: v1.0
최종 수정: 2026-06-28 16:34
상태: 확정
---

# Deploy Config: 001-skeleton-bootstrap

## 목차

- [배포 전략](#배포-전략)
- [컨테이너 구성](#컨테이너-구성)
- [CI/CD 파이프라인](#cicd-파이프라인)
- [환경 변수](#환경-변수)
- [배포 검증 결과](#배포-검증-결과)
- [검증 세부 내역](#검증-세부-내역)
- [미결 사항 (후속 단계 위임)](#미결-사항-후속-단계-위임)

---

## 배포 전략

- **배포 방식**: Rolling deploy (Fly.io 기본 전략)
- **롤백 트리거 조건**: Fly.io 헬스체크(`GET /health`) 응답 실패 → 배포 자동 중단 + 이전 릴리즈 유지
- **롤백 절차**:
  1. `flyctl releases list` — 이전 릴리즈 번호 확인
  2. `flyctl releases rollback <version>` — 이전 이미지로 즉시 재배포
  3. DB 마이그레이션 롤백 필요 시: 별도 zero-downtime 마이그레이션 spec으로 분리 (infra.md §3 참조)

> **Fly.io 실배포(flyctl deploy)는 후속 단계 대상**: ASM-001에 의해 fly.toml·flyctl 배포 검증은 본 단계 범위 외. 본 문서는 Dockerfile·CI·docker-compose 검증 결과를 기록한다.

---

## 컨테이너 구성

- **기본 이미지**: `node:20-alpine` (builder 및 runtime 동일)
- **리소스 제한**: shared-cpu-1x, 256MB (Fly.io — infra.md §3 하드웨어 요구사항)
- **헬스체크 엔드포인트**: `GET /health` (HTTP 200 + `{"status":"ok"}`, Fly.io `[[services.http_checks]]`로 설정 — fly.toml 담당)
- **멀티스테이지 구성**:

  | 스테이지 | 이미지 | 역할 |
  |---|---|---|
  | builder | node:20-alpine | pnpm install(전체 deps) → prisma generate → nest build |
  | runtime | node:20-alpine | pnpm install --prod → builder dist·prisma·.pnpm 복사 |

- **포트**: 3000 (EXPOSE 3000, ENV PORT=3000)
- **시작 명령**: `node apps/backend/dist/main.js`
- **적용 수정사항**: Dockerfile L53 `COPY --from=builder /app/apps/backend/node_modules/.prisma` 제거 — pnpm 워크스페이스에서 Prisma 클라이언트는 `.pnpm` 가상 스토어에 생성되므로 해당 경로가 존재하지 않음. `.pnpm` 스토어 전체 복사(L52)로 이미 포함.

---

## CI/CD 파이프라인

- **플랫폼**: GitHub Actions
- **트리거 조건**: `push` 및 `pull_request` to `main` 브랜치
- **파이프라인 단계**: lint → typecheck → test → docker-build (단방향 needs 체인)

| 단계 | Job 명 | needs | runner |
|---|---|---|---|
| 1 | lint | (없음) | ubuntu-latest |
| 2 | typecheck | lint | ubuntu-latest |
| 3 | test | typecheck | ubuntu-latest |
| 4 | docker-build | test | ubuntu-latest |

- **Node.js 버전**: 20
- **패키지 매니저**: pnpm 9 (pnpm/action-setup@v4)
- **Docker 빌드**: `docker build -f apps/backend/Dockerfile .` (docker/setup-buildx-action@v3)

---

## 환경 변수

환경 변수는 `.env.example` 참조. 실제 값은 이 파일에 기록하지 않는다.

**애플리케이션이 실제로 읽는 환경 변수 (3개)**:

| 변수명 | 필수 여부 | 비고 |
|---|---|---|
| `DATABASE_URL` | 필수 | Prisma 연결. 미설정 시 앱 기동 불가 |
| `JWT_ACCESS_SECRET` | 필수 | 미설정 시 앱 시작 시 예외 발생 |
| `JWT_REFRESH_SECRET` | 필수 | 미설정 시 앱 시작 시 예외 발생 |
| `NODE_ENV` | 선택 | Dockerfile에서 `production` 설정. pino-pretty 제어 |
| `PORT` | 선택 | 기본값 3000. Dockerfile에서 3000 설정 |

> **주의**: `.env.example`의 `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`은 현재 애플리케이션이 읽지 않음. 이 값들은 `jwt.config.ts`의 하드코딩 상수(`JWT_ACCESS_TTL_SECONDS=900`, `JWT_REFRESH_TTL_DAYS=30`)로 고정 관리된다. → GAP-006 참조.

---

## 배포 검증 결과

| 항목 | 결과 | 비고 |
|---|---|---|
| 멀티스테이지 Dockerfile 구조 (FR-014, SC-022) | **PASS** | Dockerfile 수정 후 빌드 성공 |
| docker-compose config 구문 유효 | **PASS** | `docker compose config --quiet` 성공 |
| backend docker build 동적 검증 (SC-022) | **PASS** | `docker build -f apps/backend/Dockerfile .` 성공 |
| CI needs 체인 정합성 (SC-023~026) | **PASS** | lint→typecheck→test→docker-build 단방향 체인 확인 |
| .env.example 필수 env 매칭 (3개) | **PASS** | DATABASE_URL·JWT_ACCESS_SECRET·JWT_REFRESH_SECRET 모두 존재 |
| .env.example 전체 매칭률 | **WARN** | JWT_ACCESS_TTL·JWT_REFRESH_TTL 2개 추가 항목 — 코드에서 미사용 (GAP-006) |
| 헬스체크 엔드포인트 | **PASS** (코드) | GET /health 엔드포인트 구현 완료. Fly.io 구성은 fly.toml 담당(후속) |
| 롤백 절차 | **DEFINED** | flyctl releases rollback (fly.toml 범위 내) |
| Dockerfile HEALTHCHECK 지시어 | **WARN** | Docker HEALTHCHECK 미설정. Fly.io healthcheck로 갈음 예정 (GAP-007) |

---

## 검증 세부 내역

### Dockerfile 구조 검증

**수정 전 실패 원인**: `apps/backend/Dockerfile` L53
```dockerfile
# 제거된 라인 (pnpm 워크스페이스에서 이 경로는 존재하지 않음)
COPY --from=builder /app/apps/backend/node_modules/.prisma ./apps/backend/node_modules/.prisma
```

**원인**: pnpm 워크스페이스에서 `prisma generate` 실행 시 Prisma 클라이언트는
`node_modules/.pnpm/@prisma+client@6.19.3_../node_modules/.prisma/`에 생성된다.
`apps/backend/node_modules/.prisma`는 존재하지 않는다.
L52의 `COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm`이 이미 Prisma 클라이언트를 포함한다.

**수정 후 빌드 결과**: 성공 (14단계 → 12단계, runtime 스테이지 정상 완료)

### CI needs 체인 검증

```yaml
# SC-023: lint 실패 → typecheck·test·docker-build 차단
typecheck: needs: lint       ✓
# SC-024: typecheck 실패 → test·docker-build 차단
test: needs: typecheck       ✓
# SC-025: test 실패 → docker-build 차단
docker-build: needs: test    ✓
# SC-026: 전 단계 통과 → docker-build 실행
docker-build: needs: test (test→typecheck→lint 체인) ✓
```

### .env.example 매칭 분석

| 변수 | .env.example | 코드 읽기 | 판정 |
|---|---|---|---|
| DATABASE_URL | ✓ | prisma schema `env("DATABASE_URL")` | MATCH |
| JWT_ACCESS_SECRET | ✓ | jwt.config.ts `process.env['JWT_ACCESS_SECRET']` | MATCH |
| JWT_REFRESH_SECRET | ✓ | jwt.config.ts `process.env['JWT_REFRESH_SECRET']` | MATCH |
| JWT_ACCESS_TTL | ✓ | **미사용** (상수 `JWT_ACCESS_TTL_SECONDS=900`) | EXTRA |
| JWT_REFRESH_TTL | ✓ | **미사용** (상수 `JWT_REFRESH_TTL_DAYS=30`) | EXTRA |

### docker-compose.yml 검증

- 서비스: `postgres` (postgres:16-alpine)
- 목적: 로컬 개발용 PostgreSQL. backend는 `pnpm --filter backend dev`로 별도 실행
- infra.md §6 로컬 개발 환경과 일치 ✓
- `docker compose config --quiet` → 구문 유효 ✓

---

## 미결 사항 (후속 단계 위임)

| 항목 | 담당 | 비고 |
|---|---|---|
| Fly.io fly.toml 헬스체크 설정 | 후속 배포 단계 | `[[services.http_checks]]` path=/health |
| `flyctl deploy` 실배포 검증 | 후속 배포 단계 | ASM-001 범위 |
| Fly secrets 환경변수 주입 | 후속 배포 단계 | DATABASE_URL·JWT_ACCESS_SECRET·JWT_REFRESH_SECRET |
| Dockerfile HEALTHCHECK 지시어 추가 | 선택 개선 | GAP-007 참조 |
| .env.example JWT_ACCESS_TTL·JWT_REFRESH_TTL 제거 또는 주석 처리 | 선택 개선 | GAP-006 참조 |
