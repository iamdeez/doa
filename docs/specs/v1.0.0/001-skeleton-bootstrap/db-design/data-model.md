---
작성: Database Design Agent
버전: v1.0
최종 수정: 2026-06-28
상태: 확정
---

# Data Model: 001-skeleton-bootstrap

## 목차

- [DB 선택 및 근거](#db-선택-및-근거)
- [엔티티 관계도 (ERD)](#엔티티-관계도-erd)
- [테이블 정의](#테이블-정의)
  - [users.users](#usersusers)
  - [users.refresh_tokens](#usersrefresh_tokens)
  - [빈 스키마 7개 (테이블 미포함)](#빈-스키마-7개-테이블-미포함)
- [인덱스 전략](#인덱스-전략)
- [데이터 무결성 규칙](#데이터-무결성-규칙)
- [마이그레이션 계획](#마이그레이션-계획)
- [롤백 전략](#롤백-전략)

---

## DB 선택 및 근거

- **DB 엔진**: PostgreSQL 16 (단일 인스턴스, Fly Postgres)
- **선택 근거**: constitution.md P-003(단일 DB 원칙) — PostgreSQL 단일 인스턴스 외 외부 저장소 금지. context.md §1 기술 스택 확정값 계승.
- **스키마 분리 전략**: 8개 PostgreSQL 스키마 네임스페이스로 도메인 경계 분리 (Prisma multiSchema). context.md §4 "스키마 분리 구조" 직접 계승.
- **ORM**: Prisma `^6.19.0` — multiSchema **GA**(6.7.0+), `previewFeatures = ["multiSchema"]` flag 불필요. research.md 핀 버전 확정값.
- **Stage 1 범위**: users 스키마 2개 테이블만 실체화. 나머지 7개 스키마는 `CREATE SCHEMA IF NOT EXISTS` 선언만(테이블 미포함). FR-004 기준.

---

## 엔티티 관계도 (ERD)

context.md §4 도메인 모델 기반 엔티티 도출. §5 도메인 용어 사전 준수(동의어 사용 금지: "스키마" = PostgreSQL 도메인 네임스페이스).

**Stage 1 실체화 엔티티 (users 스키마)**:

```
┌─────────────────────────────────────────────┐
│             users.users (User)              │
├─────────────────────────────────────────────┤
│ PK  id          TEXT        NOT NULL        │
│     email       TEXT        NOT NULL UNIQUE │
│     password    TEXT        NOT NULL        │  ← bcrypt 해시 (NFR-005)
│     createdAt   TIMESTAMP   NOT NULL        │
└───────────────────┬─────────────────────────┘
                    │ 1 : N
                    │ ON DELETE CASCADE
                    ▼
┌─────────────────────────────────────────────┐
│     users.refresh_tokens (RefreshToken)     │
├─────────────────────────────────────────────┤
│ PK  id          TEXT        NOT NULL        │
│ FK  userId      TEXT        NOT NULL        │  → users.users.id
│     tokenHash   TEXT        NOT NULL UNIQUE │  ← SHA-256 해시 (ADR-003)
│     expiresAt   TIMESTAMP   NOT NULL        │
│     revoked     BOOLEAN     NOT NULL        │  DEFAULT false
│     createdAt   TIMESTAMP   NOT NULL        │
└─────────────────────────────────────────────┘
```

**Stage 1 스키마 선언만 (테이블 미포함)**: products, commerce, orders, payments, settlements, admin, files

- FR-004: `schemas` 배열 선언으로 네임스페이스만 생성.
- GAP-001 안전망: Prisma가 모델 없는 빈 스키마의 `CREATE SCHEMA` SQL을 누락할 가능성이 있어 마이그레이션 SQL에 8개 `CREATE SCHEMA IF NOT EXISTS` 전부 명시(T-A4, 멱등).

---

## 테이블 정의

### users.users

| 컬럼명 | 타입 | 제약조건 | 설명 |
|---|---|---|---|
| `id` | `TEXT` | `PRIMARY KEY` | Prisma cuid / uuid 생성값 |
| `email` | `TEXT` | `NOT NULL`, `UNIQUE` | 로그인 식별자. 중복 불가. |
| `password` | `TEXT` | `NOT NULL` | bcrypt 해시값만 저장 (NFR-005: 원문 미저장) |
| `createdAt` | `TIMESTAMP(3)` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | 가입 일시 |

- **Prisma 모델명**: `User`
- **테이블 매핑**: `@@schema("users") @@map("users")`
- **관계**: `RefreshToken[]` (1:N)

### users.refresh_tokens

| 컬럼명 | 타입 | 제약조건 | 설명 |
|---|---|---|---|
| `id` | `TEXT` | `PRIMARY KEY` | Prisma cuid / uuid 생성값 |
| `userId` | `TEXT` | `NOT NULL`, `FK → users.users.id` | 토큰 소유자 참조 |
| `tokenHash` | `TEXT` | `NOT NULL`, `UNIQUE` | refresh token 원문의 SHA-256 해시. DB 조회 키 (ADR-003) |
| `expiresAt` | `TIMESTAMP(3)` | `NOT NULL` | 만료 일시 (발급 시점 + 30일, NFR-004) |
| `revoked` | `BOOLEAN` | `NOT NULL DEFAULT false` | 명시적 무효화 여부 (logout 시 true로 갱신) |
| `createdAt` | `TIMESTAMP(3)` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | 발급 일시 |

- **Prisma 모델명**: `RefreshToken`
- **테이블 매핑**: `@@schema("users") @@map("refresh_tokens")`
- **관계**: `user User @relation(fields: [userId], references: [id], onDelete: Cascade)`
- **ADR-003 근거**: SHA-256(결정적 해시)를 사용하는 이유 — refresh 검증·logout 시 제출 원문으로 DB row를 **조회(lookup)** 해야 하므로 salt가 매번 달라지는 bcrypt는 불가. refresh token은 고엔트로피 JWT(`jti` uuid 포함)라 무염 SHA-256의 brute-force 위험이 낮다.

### 빈 스키마 7개 (테이블 미포함)

| 스키마 | Stage 1 테이블 | 담당 모듈 | 추가 시점 |
|---|---|---|---|
| `products` | 없음 | `product`, `inventory`, `search` | Stage 2+ |
| `commerce` | 없음 | `cart`, `coupon`, `review` | Stage 2+ |
| `orders` | 없음 | `order`, `shipping` | Stage 2+ |
| `payments` | 없음 | `payment` | Stage 2+ |
| `settlements` | 없음 | `settlement` | Stage 2+ |
| `admin` | 없음 | `notification`, `banner`, `stats`, `admin` | Stage 2+ |
| `files` | 없음 | `file` | Stage 2+ |

---

## 인덱스 전략

| 테이블 | 컬럼 | 인덱스 유형 | 생성 방식 | 용도 |
|---|---|---|---|---|
| `users.users` | `email` | UNIQUE (btree) | Prisma `@unique` → `CREATE UNIQUE INDEX "users_email_key"` | 로그인 lookup, 중복 가입 차단 (SC-010 409 응답) |
| `users.refresh_tokens` | `tokenHash` | UNIQUE (btree) | Prisma `@unique` → `CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key"` | refresh/logout 해시 lookup O(1). `jti` 포함 JWT이므로 해시 충돌 위험 없어 UNIQUE 적용 가능 |
| `users.refresh_tokens` | `userId` | 일반 (btree) | Prisma FK → `CREATE INDEX "refresh_tokens_userId_idx"` | FK 인덱스(ON DELETE CASCADE 성능), 사용자별 토큰 조회 |

**비정규화 없음**: users 스키마 2개 테이블은 완전 정규화 설계. 별도 비정규화 근거 불필요.

---

## 데이터 무결성 규칙

### NOT NULL 제약

모든 컬럼이 `NOT NULL`. 선택적 데이터가 없으므로 NULL 허용 컬럼 없음.

### UNIQUE 제약

| 테이블 | 컬럼 | 위반 시 동작 |
|---|---|---|
| `users.users` | `email` | `UniqueViolation` → `ConflictException`(409) 매핑 |
| `users.refresh_tokens` | `tokenHash` | `UniqueViolation` → 중복 발급 차단 (`jti` uuid로 실질적으로 미발생) |

### 참조 무결성 (FK)

| 참조 테이블 | FK 컬럼 | 참조 대상 | ON DELETE | ON UPDATE |
|---|---|---|---|---|
| `users.refresh_tokens` | `userId` | `users.users.id` | `CASCADE` | `CASCADE` |

- `ON DELETE CASCADE` 근거: 사용자 삭제 시 해당 사용자의 refresh token 행도 자동 제거. 고아 레코드(orphan row) 방지. 향후 회원 탈퇴 기능에서 별도 token 정리 로직 불필요.

### CHECK 제약

Stage 1에서는 CHECK 제약 없음. `expiresAt > createdAt` 논리 검증은 애플리케이션 레이어(AuthService)에서 보장.

### DEFAULT 값

| 테이블 | 컬럼 | DEFAULT |
|---|---|---|
| `users.users` | `createdAt` | `CURRENT_TIMESTAMP` |
| `users.refresh_tokens` | `revoked` | `false` |
| `users.refresh_tokens` | `createdAt` | `CURRENT_TIMESTAMP` |

---

## 마이그레이션 계획

| 파일 | 내용 | 관련 요구사항 |
|---|---|---|
| `migrations/20260628111000_init_up.sql` | 8개 `CREATE SCHEMA IF NOT EXISTS` + `users.users` 테이블 + `users.refresh_tokens` 테이블 + 인덱스 + FK | FR-004, FR-005, FR-006, SC-004, SC-005, SC-006 |
| `migrations/20260628111000_init_down.sql` | FK 제거 → 인덱스 제거 → 테이블 제거 → 스키마 제거 (역순) | 롤백 전략 |

**T-A4 GAP-001 안전망 반영**:

Prisma `^6.19.0`에서 `schemas` 배열에 선언만 되고 `@@schema` 모델이 없는 빈 7개 스키마(products·commerce·orders·payments·settlements·admin·files)의 `CREATE SCHEMA`가 자동 생성되지 않을 수 있다. 마이그레이션 SQL 상단에 **8개 스키마 전부** `CREATE SCHEMA IF NOT EXISTS` 명시(멱등)하여 이 불확실성을 제거한다.

**실제 구현 시 Development Agent가 수행할 절차** (T-A4 참조):
1. `prisma migrate dev --create-only` → 초기 `migration.sql` 생성
2. 생성된 SQL에 8개 `CREATE SCHEMA IF NOT EXISTS` 전부 존재하는지 검증
3. 빈 7개 스키마 SQL이 누락 시 → SQL 상단에 수동 보강
4. `prisma migrate dev` 실행 → SC-006 검증 (`prisma migrate dev` 에러 0, 8 스키마 + users 2테이블)

---

## 롤백 전략

**원칙**: Prisma는 자동 Down migration을 생성하지 않는다. 롤백 SQL을 별도 파일로 관리한다.

| 상황 | 롤백 방법 |
|---|---|
| `prisma migrate dev` 실패 | Prisma의 마이그레이션 상태를 `prisma migrate resolve --rolled-back` 으로 해제, DB는 `init_down.sql` 수동 실행 |
| 스키마/테이블 구조 오류 발견 | `init_down.sql` 실행 후 스키마 수정 → 신규 마이그레이션 파일 생성 |
| 운영 환경 긴급 롤백 | DBA 검토 하에 `init_down.sql` 단계적 실행. CASCADE 주의 — users 스키마 제거 시 refresh_tokens 포함 전체 삭제됨 |

**롤백 실행 순서** (`init_down.sql` 내 역순):
1. FK 제약 제거 (`refresh_tokens_userId_fkey`)
2. 인덱스 제거 (`refresh_tokens_tokenHash_key`, `users_email_key`, FK 인덱스)
3. 테이블 제거 (`users.refresh_tokens` → `users.users` 순: FK 의존성 역순)
4. 스키마 제거 (8개, `DROP SCHEMA IF EXISTS` — CASCADE 사용하지 않아 실수 방지)
