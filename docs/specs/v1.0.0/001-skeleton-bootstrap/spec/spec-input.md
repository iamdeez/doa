---
작성: Spec Agent
버전: v1.0
최종 수정: 2026-06-28
상태: 확정
---

# Spec Input: 001-skeleton-bootstrap

> 수집 일시: 2026-06-28 | 사용자 최종 확인: main session 경유 답변 수령 완료

## 수집 진행 상태

| 카테고리 | 상태 | 마지막 질문 번호 | 답변 완료 항목 |
|---|---|---|---|
| 1. 배경 및 목적 | 완료 | Q3 | [Q1, Q2, Q3] |
| 2. 사용자 & 이해관계자 | 완료 | Q6 | [Q4, Q5, Q6] |
| 3. 핵심 기능 | 완료 | Q9 | [Q7-A, Q7-B, Q7-C, Q7-D, Q8, Q9] |
| 4. 데이터 & 입출력 | 완료 | Q12 | [Q10, Q11, Q12] |
| 5. 제약조건 | 완료 | Q16 | [Q13, Q14, Q15, Q16] |
| 6. 운영 환경 | 완료 | Q19 | [Q17, Q18, Q19] |
| 7. 예외 & 실패 시나리오 | 완료 | Q22 | [Q20, Q21, Q22] |

---

## 질문 분석 근거 (Question Analysis Basis)

| 질문 ID | 요지 | 옵션별 근거·trade-off | 추천안(이유) | 채택 결과 |
|---|---|---|---|---|
| Q7-A | NestJS 모듈 골격 범위 | A: 18개 전부 4계층 빈 골격 + auth 실구현 / B: auth만 실구현 나머지 module.ts만 / C: auth+user 실구현 나머지 module.ts만 | A — REBUILD-PLAN §12 "모듈 골격"이 명시. Stage 2에서 구조 재작업 방지 | 옵션 A 채택 |
| Q7-B | Prisma 스키마 범위 | A: 8개 스키마 선언 + users 스키마만 완성 / B: 8개 스키마 + 전체 테이블 / C: users 스키마만 선언·완성 | A — 스키마 네임스페이스 확보 + auth 구현 가능. 나머지는 Stage 2+에서 추가 | 옵션 A 채택 |
| Q7-C | auth 엔드포인트 범위 | A: register+login+refresh+logout / B: A에서 register 제외 / C: A + GET /auth/me | C — register 없이 login 검증 불가. GET /auth/me로 JWT 가드 동작 검증 가능 | 옵션 C 채택 |
| Q7-D | apps/console·worker·packages 범위 | A: Turborepo workspace 설정만 / B: Next.js console init 포함 / C: worker pg-boss 설정 포함 | A — Stage 1 목표는 "배포 가능한 빈 백엔드". console/worker 실체화는 각 로드맵 단계에서 | 옵션 A 채택 |
| Q15-A | /health P95 응답시간 | A: 200ms 이내 / B: 수치 없음 / C: 직접 지정 | A — Fly.io 헬스체크 기본값(2초) 대비 충분한 여유. 로컬/dev 환경 합리적 기준 | 옵션 A 채택 |
| Q16-A | JWT 만료 시간 | A: Access 15분·Refresh 30일 / B: Access 1시간·Refresh 7일 / C: 직접 지정 | A — 보안(단시간 Access Token)·UX(30일 Refresh) 균형 | 옵션 A 채택 |

---

## 카테고리별 수집 내용

### [카테고리 1] 배경 및 목적

**Q1. 이 시스템/기능을 왜 만드는가? (REBUILD-PLAN §1 + Stage 1 목적)**

- AWS 의존 완전 제거: AWS 전용 SDK·서비스 의존을 0으로 만든다.
- 비용 최소화: 컨테이너/DB 수를 최소화하여 월 고정비를 1/10 수준으로 절감한다.
- 운영 단순화: 단일 배포 단위(모듈러 모놀리스)로 배포·관측·디버깅을 단순화한다.
- 기능 보존: 기존 18개 도메인의 핵심 기능을 모듈 경계로 계승한다.
- Stage 1 특정 목적: 이후 단계(2~6)의 공통 기반이 되는 프로젝트 골격 구축. 팀이 단일 기반 위에서 도메인별 병렬 개발을 시작할 수 있게 한다.

**Q2. 현재 어떻게 해결하고 있는가?**

- doa-next 레포에 코드베이스 없음. REBUILD-PLAN.md와 .claude/ 설정 문서만 존재하는 초기 상태.
- 기존 AWS 기반 MSA(doa-market 등)가 별도 레포에서 운영 중이나 이 프로젝트와 독립.

**Q3. 성공 판단 기준 — 옵션 B 채택**

아래 5개 조건이 모두 충족될 때 Stage 1 완료:

1. GET /health → HTTP 200 반환
2. auth API 5종(register/login/refresh/logout/me) 모두 동작
3. GitHub Actions CI 전 단계(lint → typecheck → test → docker build) 통과
4. 18개 도메인 모듈 4계층 골격 파일 전부 존재
5. Prisma multiSchema 마이그레이션 에러 없이 통과

---

### [카테고리 2] 사용자 & 이해관계자

**Q4. 누가 이 시스템을 사용하는가?**

- 백엔드 개발팀: API 개발 기반 마련 및 CI 환경 활용 목적
- Stage 1 결과물은 실제 고객·판매자·관리자에게 미노출 (내부 개발팀 전용)

**Q5. 각 사용자 유형의 기술 수준**

- NestJS, TypeScript, Prisma, Turborepo에 익숙한 백엔드 개발자

**Q6. 이해관계자**

- 백엔드 개발팀 (주 사용자, 개발 기반 마련)
- 프로젝트 오너 (Stage 1 완료 여부 검토)

---

### [카테고리 3] 핵심 기능

**Q7-A. NestJS 모듈 골격 범위 — 옵션 A 채택**

18개 도메인 모두 4계층 빈 골격 생성(controller/service/repository/events):
- 대상: auth, user, seller, product, inventory, cart, coupon, order, payment, shipping, settlement, review, search, notification, file, banner, stats, admin
- auth 모듈만 실제 구현 (login/register/refresh/logout/me)
- 나머지 17개: 4계층 파일 구조 존재 + 빈 내용 (콘텐츠 없는 스텁)

**Q7-B. Prisma 스키마 범위 — 옵션 A 채택**

- 8개 스키마 네임스페이스 선언: users, products, commerce, orders, payments, settlements, admin, files
- users 스키마 테이블만 완성: users(사용자 기본 정보), refresh_tokens(JWT Refresh 토큰)
- 나머지 7개 스키마: 네임스페이스만 선언, 테이블 미정의 (Stage 2+에서 추가)

**Q7-C. auth 엔드포인트 범위 — 옵션 C 채택**

- POST /auth/register: 사용자 등록 (이메일, 비밀번호)
- POST /auth/login: 로그인 → Access Token + Refresh Token 발급
- POST /auth/refresh: Refresh Token → 새 Access Token 발급
- POST /auth/logout: 현재 Refresh Token 무효화
- GET /auth/me: 인증된 현재 사용자 기본 정보 반환

**Q7-D. Turborepo/앱 골격 범위 — 옵션 A 채택**

- Turborepo workspace 설정: 루트 package.json(workspace 정의) + turbo.json + pnpm-workspace.yaml
- 워크스페이스 폴더 존재: apps/backend, apps/console, apps/worker, packages/shared-types, packages/api-client, packages/ui
- apps/console, apps/worker: package.json + README.md 수준 (실체화는 후속 단계)
- packages/*: package.json + 빈 index.ts 수준

**Q8. 있으면 좋지만 필수 아닌 기능**

- Swagger/OpenAPI 문서 자동화 (@nestjs/swagger) — Stage 1 이후 고려
- docker-compose.yml (로컬 개발용 PostgreSQL) — Should로 포함 권장

**Q9. 명시적 제외 (Out of Scope)**

- 17개 비-auth 모듈의 실제 비즈니스 로직
- Fly.io 자동 배포 (CI는 docker build까지만)
- apps/console Next.js 실제 구현 (후속 단계)
- apps/worker pg-boss 실제 설정 (후속 단계)
- Flutter 고객 앱 변경
- 비밀번호 재설정 기능 (이메일 알림 의존)
- 소셜 로그인 (OAuth)
- users 스키마의 sellers, addresses, wishlists, product_views, auth_tokens 테이블
- products, commerce, orders, payments, settlements, admin, files 스키마 테이블 정의

---

### [카테고리 4] 데이터 & 입출력

**Q10. users 스키마 Stage 1 테이블 — 2개만**

- users: 사용자 기본 정보 (이메일, 해싱된 비밀번호, 가입일시 등)
- refresh_tokens: JWT Refresh Token 정보 (토큰값, 만료일시, 무효화 여부)
- 제외 (후속 단계): sellers, addresses, wishlists, product_views, auth_tokens

**Q11. 외부 시스템 연동**

Stage 1 연동 없음:
- PostgreSQL: 필수 (Prisma 경유)
- Cloudflare R2, PG사, FCM: Stage 2+ 범위 외

**Q12. 데이터 민감도**

- 비밀번호: 단방향 해싱 저장 필수 (원문 DB 저장 금지)
- JWT 시크릿: 환경변수 관리 (`.env` / Fly secrets), DB 미저장
- Refresh Token: users.refresh_tokens 테이블에 저장 (만료·무효화 관리)

---

### [카테고리 5] 제약조건

**Q13. 기술 스택 (확정 — REBUILD-PLAN §4 기반)**

- 언어/런타임: TypeScript + Node.js
- 백엔드 프레임워크: NestJS (확정)
- ORM: Prisma (multiSchema, 확정)
- DB: PostgreSQL 16 (Fly Postgres)
- 모노레포: Turborepo + pnpm (확정)
- 컨테이너: Docker (멀티스테이지 빌드)
- CI: GitHub Actions
- 로그: pino (구조적 로그)

**Q14. 일정 제약**

- 명시적 일정 제약 없음. REBUILD-PLAN 로드맵 단계 1 → 2 순서 준수.

**Q15. 성능 요구사항 — 옵션 A 채택**

- GET /health: P95 응답시간 200ms 이내 (로컬/dev 환경 기준, 연속 50회 요청)
- /auth/* 엔드포인트: P95 응답시간 500ms 이내 (로컬/dev 환경 기준, 연속 50회 요청)

**Q16. JWT 만료 시간 — 옵션 A 채택**

- Access Token: 발급 시점으로부터 15분
- Refresh Token: 발급 시점으로부터 30일

---

### [카테고리 6] 운영 환경

**Q17. 실행 환경 (infra.md 기반)**

- 로컬: Docker Compose (PostgreSQL 컨테이너)
- dev/prod: Fly.io 앱

**Q18. 예상 사용자 수·데이터 규모**

- Stage 1: 백엔드 개발팀 내부 사용. 수 명 수준의 테스트 계정만 존재.
- 실 사용자 부하: Stage 2+ 이후.

**Q19. 배포 담당·CI 범위 — 옵션 B 채택**

- CI 범위: lint + typecheck + test + docker build (Fly.io 자동 배포 제외)
- 이유: Stage 1 시점 Fly.io 계정·시크릿 미준비 가정 (ASM-001)
- 수동 배포: 개발팀이 직접 `flyctl deploy` 실행

---

### [카테고리 7] 예외 & 실패 시나리오

**Q20. CI 실패 시 처리 — Y 채택**

- lint 실패 시: typecheck·test·docker build 단계 미실행 (차단)
- typecheck 실패 시: test·docker build 단계 미실행 (차단)
- test 실패 시: docker build 단계 미실행 (차단)

**Q21. 예상 오류 상황·엣지 케이스**

- 중복 이메일 가입 시도: HTTP 409 반환
- 잘못된 비밀번호로 로그인: HTTP 401 반환
- 만료된 Access Token으로 인증 요청: HTTP 401 반환
- 로그아웃된 Refresh Token으로 갱신 요청: HTTP 401 반환
- 만료된 Refresh Token으로 갱신 요청: HTTP 401 반환
- /health는 앱 alive 여부만 확인 (DB 연결 상태 미포함)

**Q22. DB 백업·복구 — 없음**

- Stage 1 dev 환경: 백업 요구사항 없음
- prod 환경 백업: 로드맵 6단계(컷오버) 이전 결정 (infra.md §8)

---

## 보완 내용

**constitution 교차 검증 완료 (P-001~P-007)**:

| 조항 | 내용 | 충돌 여부 |
|---|---|---|
| P-001 (모듈 경계) | auth 모듈이 users 스키마만 접근. 모듈 간 직접 DB 교차 쿼리 없음 | 없음 |
| P-002 (AWS 의존 금지) | Stage 1 신규 코드에 AWS SDK 없음 | 없음 |
| P-003 (단일 DB) | 단일 PostgreSQL만 사용 | 없음 |
| P-004 (클라우드 중립) | 표준 Docker + 표준 SQL. Fly.io 전용 비즈니스 로직 없음 | 없음 |
| P-005 (결제·정산) | Stage 1 범위 외 | 없음 |
| P-006 (테스트) | 모든 FR에 SC 1:1 매핑 — spec.md에서 완성 | 없음 |
| P-007 (스펙 범위) | 신규 비즈니스 기능 없음. 재구축 골격·auth만 | 없음 |

**배포 환경 cross-reference**: Q19(CI 배포 제외)가 infra.md §3 "Fly secrets 미준비 시 배포 불가" 제약과 일치. ASM-001 기록.
