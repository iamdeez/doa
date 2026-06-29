---
작성: Database Design Agent
버전: v1.0
최종 수정: 2026-06-29 17:50
상태: 확정 (retroactive)
---

# Data Model: 006-search-notification-file

## 목차

- [DB 선택 및 근거](#db-선택-및-근거)
- [엔티티 관계도 (ERD)](#엔티티-관계도-erd)
- [테이블 정의](#테이블-정의)
  - [enum 정의](#enum-정의)
  - [notifications](#notifications)
  - [file_assets (files)](#file_assets-files)
- [인덱스 전략](#인덱스-전략)
- [데이터 무결성 규칙](#데이터-무결성-규칙)
- [금전 필드 부재 명시](#금전-필드-부재-명시)
- [마이그레이션 계획](#마이그레이션-계획)
- [롤백 전략](#롤백-전략)

---

## DB 선택 및 근거

- **DB**: PostgreSQL 16 — 단일 인스턴스(P-003). 002~005 와 동일 DB 인스턴스·Prisma multiSchema 구조 승계.
- **스키마**:
  - 알림 테이블(`notifications`)은 기존 `users` 스키마에 배치한다. 논리적 소유는 notification 모듈이며 user 모듈 소유 테이블(`users`·`sellers` 등)에 대한 직접 Prisma 쿼리는 발행하지 않는다(P-001·ADR-002).
  - 파일 테이블(`file_assets`, `@@map("files")`)은 신규 `files` 스키마에 배치한다(ADR-003).
  - **검색(search)은 자체 소유 테이블이 없다**. 상품 조회는 `ProductService` DI 경유 read-only 이므로 본 spec 의 DB 설계 대상은 알림·파일 2테이블뿐이다.
- **ORM**: Prisma `^6.19.0` multiSchema — `@@schema("users")` / `@@schema("files")` 태그로 스키마 분리.
- **cross-schema 참조 전략**: `notifications.userId`(users.users.id)·`file_assets.ownerId`(users.users.id)는 plain String 필드로만 참조하고 Prisma `@relation` 미선언(P-001·003 패턴 승계). 본 spec 의 2테이블은 단일 테이블이라 동일 스키마 FK 도 없다.
- **금전 필드 없음**: 두 테이블 모두 `Decimal` 금전 필드를 갖지 않는다(P-005 해당 없음). 상세는 [금전 필드 부재 명시](#금전-필드-부재-명시).

---

## 엔티티 관계도 (ERD)

```
[users 스키마 — notification 모듈 논리 소유]

Notification (notifications)
  │  id PK
  │  userId: String            — 사용자 ID (plain String, cross-schema: users.users.id, FK 미선언)
  │  type: NotificationType     — ORDER_PLACED | ORDER_SHIPPED | SETTLEMENT_CREATED | REVIEW_RECEIVED
  │  title: String              — 알림 제목
  │  body: String               — 알림 본문
  │  isRead: Boolean             — 읽음 여부 (default false)
  │  createdAt: DateTime         — 생성 일시 (default now)
  (단일 테이블 — 동일 스키마 FK 없음)

[files 스키마 — file 모듈 소유]

FileAsset (file_assets, @@map "files")
  │  id PK
  │  ownerId: String            — 소유자 ID (plain String, cross-schema: users.users.id, FK 미선언)
  │  purpose: FilePurpose        — PRODUCT_IMAGE | REVIEW_IMAGE | PROFILE
  │  key: String  @unique        — R2 객체 키 {purpose}/{ownerId}/{uuid}
  │  url: String                 — public URL
  │  contentType: String         — MIME 타입 (클라이언트 입력, 무검증 — SEC-FIND-006-02)
  │  size: Int                   — 바이트 크기 (presign 시 0 placeholder, 금전 아님)
  │  status: FileStatus          — PENDING | UPLOADED (default PENDING)
  │  createdAt: DateTime         — 생성 일시 (default now)
  (단일 테이블 — 동일 스키마 FK 없음)

[cross-schema 의존 (plain String, FK 미선언)]
notifications.userId   → users.users.id
file_assets.ownerId    → users.users.id
```

---

## 테이블 정의

### enum 정의

| enum | 스키마 | 값 | 근거 |
|---|---|---|---|
| `NotificationType` | users | `ORDER_PLACED`, `ORDER_SHIPPED`, `SETTLEMENT_CREATED`, `REVIEW_RECEIVED` | 도메인 이벤트 종류. 향후 주문·배송·정산·리뷰 이벤트가 `create()` 호출 시 부착(현재 미연동 — GAP-006-01) |
| `FilePurpose` | files | `PRODUCT_IMAGE`, `REVIEW_IMAGE`, `PROFILE` | presign 객체 키 prefix·접근 정책 분기 |
| `FileStatus` | files | `PENDING`, `UPLOADED` | PENDING: presign 발급·업로드 대기(생성 기본값). UPLOADED: 업로드 확인 완료(confirm 엔드포인트 본 spec 범위 외 — GAP-006-02) |

### notifications

사용자 알림. notification 모듈 소유(논리), `users` 스키마(물리).

| 컬럼명 | 타입 | 제약조건 | 설명 |
|---|---|---|---|
| `id` | String | PK, `@default(cuid())` | 알림 ID |
| `userId` | String | NOT NULL | 사용자 ID — plain String (cross-schema: users.users.id, FK 미선언 P-001) |
| `type` | NotificationType | NOT NULL | 알림 종류 |
| `title` | String | NOT NULL | 알림 제목 |
| `body` | String | NOT NULL | 알림 본문 |
| `isRead` | Boolean | NOT NULL, DEFAULT false | 읽음 여부 |
| `createdAt` | DateTime | NOT NULL, `@default(now())` | 생성 일시 |

```prisma
model Notification {
  id        String           @id @default(cuid())
  /// cross-schema plain String — users.users.id 참조하지만 FK 미선언 (P-001 경계)
  userId    String
  type      NotificationType
  title     String
  body      String
  isRead    Boolean          @default(false)
  createdAt DateTime         @default(now())

  @@index([userId, isRead, createdAt(sort: Desc)])
  @@map("notifications")
  @@schema("users")
}
```

### file_assets (files)

파일 메타데이터. 실제 바이너리는 R2(객체 스토리지)에 저장, 본 테이블은 메타만 관리. Prisma 모델명 `FileAsset`, DB 테이블명 `files`(`@@map`).

| 컬럼명 | 타입 | 제약조건 | 설명 |
|---|---|---|---|
| `id` | String | PK, `@default(cuid())` | 파일 ID |
| `ownerId` | String | NOT NULL | 소유자 ID — plain String (cross-schema: users.users.id, FK 미선언 P-001) |
| `purpose` | FilePurpose | NOT NULL | 파일 용도 |
| `key` | String | NOT NULL, **UNIQUE** | R2 객체 키 — `{purpose}/{ownerId}/{uuid}` 형태 |
| `url` | String | NOT NULL | public URL |
| `contentType` | String | NOT NULL | MIME 타입 (클라이언트 입력 — allowlist 미적용 SEC-FIND-006-02) |
| `size` | Int | NOT NULL, DEFAULT 0 | 바이트 크기. presign 시 0 placeholder(업로드 확정 경로 부재로 미갱신 — GAP-006-02). **금전 아님** |
| `status` | FileStatus | NOT NULL, DEFAULT PENDING | 업로드 상태 |
| `createdAt` | DateTime | NOT NULL, `@default(now())` | 생성 일시 |

```prisma
model FileAsset {
  id          String      @id @default(cuid())
  /// cross-schema plain String — users.users.id 참조하지만 FK 미선언 (P-001 경계)
  ownerId     String
  purpose     FilePurpose
  /// R2 객체 키 — {purpose}/{ownerId}/{uuid} 형태
  key         String      @unique
  url         String
  contentType String
  size        Int         @default(0)
  status      FileStatus  @default(PENDING)
  createdAt   DateTime    @default(now())

  @@index([ownerId, createdAt(sort: Desc)])
  @@map("files")
  @@schema("files")
}
```

---

## 인덱스 전략

| 인덱스 | 대상 테이블 | 컬럼 | 목적 | 관련 FR |
|---|---|---|---|---|
| `notifications_userId_isRead_createdAt_idx` | notifications | `(userId, isRead, createdAt DESC)` | 본인 알림 목록 — 미읽음 우선·최신순 조회 | FR-004·SC-005 |
| `files_key_key` (UNIQUE) | files | `(key)` | 객체 키 유일성 보장(중복 presign 키 차단) | FR-007 |
| `files_ownerId_createdAt_idx` | files | `(ownerId, createdAt DESC)` | 소유자 기준 파일 조회 최신순 | FR-009 |

**선택 근거**:
- `(userId, isRead, createdAt DESC)` 복합 인덱스: 알림 조회가 항상 `WHERE userId=? ORDER BY isRead ASC, createdAt DESC` 패턴(미읽음 우선 최신순). 복합 인덱스로 스캔.
- `key UNIQUE`: presign 키는 `{purpose}/{userId}/{uuid}` 로 생성되며 uuid 충돌 시(이론적) DB 수준 차단. 동시에 키 기반 조회 인덱스 역할.
- `(ownerId, createdAt DESC)` 복합 인덱스: 소유자 파일 목록 조회(향후) `WHERE ownerId=? ORDER BY createdAt DESC` 패턴.

---

## 데이터 무결성 규칙

### NOT NULL / DEFAULT

| 테이블 | 컬럼 | 규칙 |
|---|---|---|
| notifications | userId, type, title, body | NOT NULL |
| notifications | isRead | DEFAULT false |
| notifications | createdAt | DEFAULT now() |
| files | ownerId, purpose, key, url, contentType | NOT NULL |
| files | size | DEFAULT 0 |
| files | status | DEFAULT 'PENDING' |
| files | createdAt | DEFAULT now() |

### UNIQUE 제약

| 테이블 | 컬럼 | 근거 |
|---|---|---|
| files | `key` | R2 객체 키 유일성. 동일 키 중복 presign 차단(uuid 기반이므로 실질 충돌 무시 가능하나 DB 수준 보장) |

> `notifications` 에는 UNIQUE 제약을 선언하지 않는다(동일 사용자에게 동일 타입 알림이 복수 발생 가능 — 부재가 곧 상태).

### 참조 무결성 (FK)

본 spec 의 2테이블에는 FK 를 선언하지 않는다.

> **cross-schema 참조 무결성 부재**: `notifications.userId`·`file_assets.ownerId`(plain String 필드)는 DB FK 미선언(P-001·003 패턴 승계). 고아 레코드 방지는 앱 레벨 서비스 DI 경계로 관리. 동일 스키마 FK 도 없다(각 테이블이 단일 테이블).

### CHECK 제약

- `size` 비음수: 바이트 크기는 음수가 발생하지 않으나(presign 시 0, 업로드 확정 경로 부재) 별도 DB CHECK 미선언(Prisma 미지원).

### 멱등/원자성 관련

- 알림 읽음 처리(`markRead`)·일괄 읽음(`markAllRead`)은 멱등(`isRead=true` 재설정 무해, `updateMany where isRead:false` 는 미읽음만 대상). 파일 삭제는 단일 `delete`. 다단계 트랜잭션 미사용.

---

## 금전 필드 부재 명시

본 spec 의 신규 테이블(`notifications`·`file_assets`)에는 **금전(Decimal) 필드가 존재하지 않는다**.

- `notifications`: title·body 등 텍스트와 isRead 플래그만. 금전 무관.
- `file_assets.size`: 파일 **바이트 크기**(`Int`)일 뿐 금전이 아니다.
- 검색의 가격 필터(`minPrice`·`maxPrice`)는 `products.price`(`Prisma.Decimal`, 002 소유)에 대한 **읽기 전용 범위 비교**로, 본 spec 이 금전 필드를 신규 생성·변경하지 않는다.

따라서 P-005(결제·정산 정합성)의 `@db.Decimal` 금전 필드·부동소수점 금지·outbox/멱등키 조항은 본 spec 의 데이터 모델에 직접 적용되지 않는다(plan.md Constitution Gates P-005 = 해당 없음).

---

## 마이그레이션 계획

### 마이그레이션 파일

| 파일 | 위치 | 내용 |
|---|---|---|
| `20260629081946_006_search_notification_file/migration.sql` | `apps/backend/prisma/migrations/` | Up: NotificationType(users)·FilePurpose·FileStatus(files) enum + notifications(users)·files(files) 2테이블 + 인덱스 3종(`notifications(userId,isRead,createdAt desc)`·`files.key UNIQUE`·`files(ownerId,createdAt desc)`). 005 와 달리 단일 spec 마이그레이션이며 타 spec 드리프트 동반 없음. |

> db-design 산출물 SQL 사본은 본 spec 에서 별도 박제하지 않는다. 실제 적용 마이그레이션은 `apps/backend/prisma/migrations/20260629081946_006_search_notification_file/migration.sql` 이 SoT 다. 본 폴더의 [migrations/README.md](migrations/README.md) 가 그 경로·요약을 가리킨다(전체 SQL 중복 회피).

### 마이그레이션 순서

1. enum 3종 생성 (`users.NotificationType`, `files.FilePurpose`, `files.FileStatus`)
2. `users.notifications` 테이블 생성
3. `files.files` 테이블 생성
4. 인덱스 3종 생성 (`notifications` 복합 + `files.key` UNIQUE + `files(ownerId, createdAt desc)`)

> DOWN 시 역순. 두 테이블은 FK 가 없어 독립 DROP 가능.

---

## 롤백 전략

### DB 레벨 롤백

마이그레이션 Down 으로 006 테이블·enum 을 제거하여 005 완료 기준으로 복원한다.

```sql
-- Down 실행 순서 (역순 DROP)
DROP TABLE "files"."files";
DROP TABLE "users"."notifications";
DROP TYPE "files"."FileStatus";
DROP TYPE "files"."FilePurpose";
DROP TYPE "users"."NotificationType";
-- (신규 files 스키마 자체 제거는 별도 운영 판단)
```

### 애플리케이션 레벨 롤백

- **비파괴성**: 신규 2테이블 + 신규 files 스키마이므로 기존 테이블에 영향 없음. notifications 는 users 스키마에 추가되나 user 모듈 기존 테이블 불변.
- **하위 호환성**: schema.prisma 에서 신규 모델 2개·enum 3개 제거 후 `prisma generate` 재실행하면 애플리케이션 코드가 006 이전으로 복원 가능(단 search/notification/file 모듈 코드 + product.searchProducts 도 함께 제거 필요).
- **데이터 손실 범위**: Down 실행 시 `notifications`·`files` 의 모든 데이터 소실. 프로덕션 적용 전 백업 필수.
- **드리프트 없음**: 005 와 달리 006 마이그레이션은 단일 spec 산출물로 깔끔하다(타 spec 테이블 동반 캡처 없음).
