---
작성: Spec Agent
버전: v1.0
최종 수정: 2026-06-29 17:50
상태: 확정 (구현 완료 — retroactive 문서화)
---

# Spec: 006-search-notification-file

> Branch: 006-search-notification-file | Date: 2026-06-29 | Version: v1.0.0
>
> 본 문서는 이미 구현·검증이 완료된 코드(커밋 `f2f061a`)를 근거로 정식 SDD 포맷으로 retroactive
> 작성되었다. 모든 요구사항·수용 기준은 실제 구현된 `search`·`notification`·`file` 모듈과
> `product` 모듈 연동 코드에서 확인한 사실을 기준으로 한다.

## 목차

- [배경 및 목적](#배경-및-목적)
- [선행 spec 영향 추적](#선행-spec-영향-추적)
- [사용자 스토리](#사용자-스토리)
- [기능 요구사항](#기능-요구사항)
- [비기능 요구사항](#비기능-요구사항)
- [수용 기준](#수용-기준)
- [요구사항 구조화 매트릭스](#요구사항-구조화-매트릭스)
- [권한 평가 결과 (PATCH-001)](#권한-평가-결과-patch-001)
- [범위 외](#범위-외)
- [미결 사항](#미결-사항)

---

## 배경 및 목적

003-commerce(장바구니·주문·결제)·004-review-coupon(리뷰·쿠폰)·005-shipping-settlement(배송·정산)
완료 이후, 남은 백엔드 도메인 3종(검색·알림·파일)을 구현한다. 002-catalog 가 상품 카탈로그를
정의했으나 구매자가 키워드·카테고리·가격·정렬 조건으로 상품을 탐색하는 공개 검색 진입점이 없었다.
또한 주문·배송·정산·리뷰 등 도메인 이벤트를 사용자에게 전달할 알림 저장·조회 경로, 상품·리뷰
이미지를 객체 스토리지에 업로드하기 위한 파일 메타데이터 관리 경로가 부재했다.

**검색 (Search)**
- 구매자(비인증 포함)가 `GET /search/products` 로 키워드(상품명 부분일치)·카테고리·가격 범위·정렬
  (최신·낮은가격·높은가격) 조건으로 상품을 조회하고 offset 페이지네이션을 받는다.
- 검색 모듈은 **자체 소유 테이블이 없다**. 모든 상품 조회는 `ProductService` 공개 메서드 DI 경유의
  read-only 질의로만 수행하며(P-001), 본 모듈은 페이지네이션·정렬·기본값 정규화(orchestration)만
  담당한다. `SearchRepository` 는 빈 클래스(4계층 골격 유지용)로 보존하고 `SearchModule` providers
  에는 등록하지 않는다.
- 노출 대상은 `ACTIVE`·`OUT_OF_STOCK` 상태 상품으로 한정한다(`DRAFT`·`SUSPENDED` 등 미노출).

**알림 (Notification)**
- 인증 사용자가 본인 알림 목록을 미읽음 우선·최신순으로 조회하고, 개별/전체 읽음 처리한다.
- `NotificationService.create()` 는 도메인 이벤트(주문·배송·정산·리뷰)에서 호출 가능한 **공개
  진입점**으로 export 한다(현재 시점에는 진입점만 제공, 실제 이벤트 연동은 후속 — GAP-006-01).
- `users` 스키마에 `notifications` 테이블을 추가한다. notification 모듈은 이 테이블만 소유하며
  `userId` 는 cross-schema plain String(users.users.id 참조, FK 미선언, P-001).

**파일 (File)**
- 인증 사용자가 `POST /files/presign` 으로 presigned 업로드 URL + 파일 메타데이터(`PENDING`) 레코드를
  발급받는다. 실제 바이너리는 클라이언트가 presigned URL 로 직접 PUT 하며, 서버는 메타만 관리한다.
- 객체 스토리지(R2) 연동은 `FileStoragePort` 인터페이스 + `StubFileStorage`(무네트워크, 결정적 URL)
  추상화로 처리한다(P-002). 실제 R2 전환 시 `FILE_STORAGE` DI 토큰의 구현체만 교체한다.
- 신규 `files` 스키마에 `file_assets`(`@@map("files")`) 테이블을 추가한다. `ownerId` 는 cross-schema
  plain String(users.users.id, FK 미선언, P-001).

---

## 선행 spec 영향 추적

| 선행 spec | 식별된 연동 항목 | 인지 시점 | 식별 경로 |
|---|---|---|---|
| v1.0.0/002-catalog | 검색이 상품 카탈로그(`products` 스키마)를 read-only 조회. 006 이 `ProductService.searchProducts`·`ProductRepository.searchProducts` 신규 공개 메서드를 추가하여 키워드·카테고리·가격·정렬 질의를 제공(`ACTIVE`·`OUT_OF_STOCK` 한정). search 모듈은 이 메서드를 DI 경유로만 소비(P-001). | 2026-06-29 | 002-catalog Product 모델·ProductStatus |
| v1.0.0/005-shipping-settlement | 005 와 **독립**. 005 의 shipping·settlement 모듈/스키마와 직접 연동 없음. 단 `NotificationType` enum 에 005·004·003 도메인 이벤트 종류(`ORDER_PLACED`·`ORDER_SHIPPED`·`SETTLEMENT_CREATED`·`REVIEW_RECEIVED`)를 알림 타입으로 열거 — 향후 해당 도메인 이벤트가 `create()` 를 호출할 연동 지점(현재 미연동, GAP-006-01). | 2026-06-29 | NotificationType enum |

---

## 사용자 스토리

- **US-001**: 구매자(비인증 포함)로서, 키워드·카테고리·가격·정렬 조건으로 판매 중인 상품을 검색하고
  페이지 단위로 받아보고 싶다.
- **US-002**: 인증 사용자로서, 나에게 온 알림을 미읽음 우선·최신순으로 조회하고 싶다.
- **US-003**: 인증 사용자로서, 내 알림을 개별 또는 전체 읽음 처리하고 싶다. 타인의 알림은 읽음
  처리하거나 조회할 수 없기를 원한다.
- **US-004**: 타 도메인(주문·배송·정산·리뷰)으로서, 사용자에게 알림을 생성하는 공개 진입점이
  필요하다.
- **US-005**: 인증 사용자로서, 상품·리뷰·프로필 이미지를 업로드하기 위해 presigned 업로드 URL 과
  파일 메타 레코드를 발급받고 싶다.
- **US-006**: 인증 사용자로서, 내가 올린 파일을 삭제하고 싶다. 타인의 파일은 삭제할 수 없기를
  원한다.

---

## 기능 요구사항

### 검색 (Search)

- **FR-001**: 비인증을 포함한 사용자는 `GET /search/products` 로 상품을 검색할 수 있다. 쿼리 파라미터는
  `q`(상품명 부분일치)·`categoryId`·`minPrice`·`maxPrice`(금전 문자열)·`sort`(`latest`|`price_asc`|
  `price_desc`)·`page`·`size` 이며, 응답은 `{ items, total, page, size }` 다. `page` 기본값 1(최소 1),
  `size` 기본값 `DEFAULT_SEARCH_SIZE`(20)·최대 `MAX_SEARCH_SIZE`(100)로 클램핑된다. `sort` 기본값은
  `latest` 다. `skip = (page-1) × size`, `take = size`.

- **FR-002**: 검색은 `ProductService.searchProducts` DI 경유 read-only 질의로 수행된다(P-001 — search
  자체 테이블 없음). 노출 대상은 `ProductStatus.ACTIVE`·`OUT_OF_STOCK` 상품으로 한정되며, 정렬은
  `price_asc`/`price_desc`(price asc/desc) 또는 `latest`(createdAt desc)이고 모든 정렬의 tiebreaker 는
  `id desc` 다. `q` 는 `title contains(mode: insensitive)`, 가격은 `Prisma.Decimal` 범위 필터다.
  items 에는 `images`(displayOrder asc)가 포함된다.

### 알림 (Notification)

- **FR-003**: `NotificationService.create(userId, type, title, body)` 는 알림 생성 공개 진입점으로
  `NotificationModule` 이 export 한다. 타 도메인 서비스가 DI 로 주입받아 호출한다(예: 주문 생성 시
  `ORDER_PLACED`). repository 의 `create` 에 위임한다.

- **FR-004**: 인증 사용자는 `GET /notifications` 로 본인 알림 목록을 조회한다. 정렬은 미읽음 우선
  (`isRead asc`) → 최신순(`createdAt desc`) → `id desc` 이며 offset 페이지네이션(`page`·`size`,
  기본 20·최대 100)을 적용한다. 응답은 `{ items, total, page, size }` 다.

- **FR-005**: 인증 사용자는 `PATCH /notifications/:id/read` 로 본인 알림을 읽음 처리한다. 미존재 알림은
  404, 타인 소유 알림은 403 을 반환한다.

- **FR-006**: 인증 사용자는 `PATCH /notifications/read-all` 로 본인 미읽음 알림을 일괄 읽음 처리하고
  변경 건수(`{ updated }`)를 받는다.

### 파일 (File)

- **FR-007**: 인증 사용자는 `POST /files/presign` 으로 presigned 업로드 URL 과 메타데이터(`PENDING`)
  레코드를 발급받는다. body 는 `{ purpose(FilePurpose), contentType }` 이며, 객체 키는
  `{purpose}/{userId}/{uuid}` 형태(`randomUUID()`)다. `FileStoragePort.getPresignedUploadUrl` 로
  `uploadUrl`·`publicUrl` 을 받아 `FileAsset`(status=`PENDING`, size=0)을 생성하고
  `{ id, key, uploadUrl, url }` 를 반환한다(HTTP 201).

- **FR-008**: 인증 사용자는 `GET /files/:id` 로 파일 메타를 조회한다. 미존재 파일은 404 를 반환한다.

- **FR-009**: 인증 사용자는 `DELETE /files/:id` 로 본인 소유 파일을 삭제한다(HTTP 204). 미존재 파일은
  404, 타인 소유 파일은 403 을 반환한다.

---

## 비기능 요구사항

- **NFR-001** (P-001 모듈 경계): `search` 모듈은 자체 소유 테이블이 없으며 상품 데이터를
  `ProductService` 공개 메서드 DI 경유로만 조회한다(`SearchRepository` 는 빈 클래스, providers 미등록).
  `notification` 모듈 Repository 는 `users.notifications` 만, `file` 모듈 Repository 는 `files.files`
  (`fileAsset`)만 Prisma 로 직접 접근한다. 타 도메인 스키마 모델 직접 참조는 금지된다. cross-schema
  참조(`notifications.userId`·`file_assets.ownerId`)는 전부 plain String(FK 미선언).

- **NFR-002** (P-002 외부 의존 금지): 신규 npm 의존성 0 건. 객체 스토리지(R2) 연동은 `FileStoragePort`
  인터페이스 + `StubFileStorage` 추상화로 처리하며, stub 은 외부 네트워크 호출 없이 결정적 URL
  (`https://r2.stub.local/{key}`)만 반환한다. `FILE_STORAGE` DI 토큰으로 바인딩한다(`@aws-sdk/*` 등
  AWS 전용 SDK 미사용).

- **NFR-003** (인증): `notifications` 3 엔드포인트와 `files` 3 엔드포인트는 `JwtAuthGuard` 로 보호되며
  유효하지 않거나 없는 JWT 로 요청 시 HTTP 401 을 반환한다. `GET /search/products` 는 공개(인증 불필요)
  엔드포인트다.

- **NFR-004** (자원 소유권 / IDOR 차단): 알림 읽음 처리(`markRead`)·파일 삭제(`delete`)는 자원 소유권
  (`notification.userId === me` / `file.ownerId === me`)을 서버에서 검증하여 타인 자원 조작을 차단한다
  (불일치 403, 미존재 404).

- **NFR-005** (금전 필드 부재 — P-005 해당 없음): 006 신규 테이블(`notifications`·`file_assets`)에는
  금전 필드가 없다. 검색의 가격 필터(`minPrice`·`maxPrice`)는 `products.price`(`Prisma.Decimal`)에
  대한 **읽기 전용 범위 비교**일 뿐이며 정산·결제 같은 금전 상태 변경이 없다. 따라서 P-005(결제·정산
  정합성) 조항은 본 spec 에 직접 해당하지 않는다.

---

## 수용 기준

> **환경 태그 규약**:
> | 태그 | 의미 |
> |---|---|
> | `[env:static]` | 코드·설정·스키마 파일 존재·구조 검증만으로 판정 가능 |
> | `[env:unit]` | 단위 테스트(mock)로 판정 가능 |
> | `[env:integration]` | AppModule 부팅(DI 그래프) 기반 통합 부팅 테스트로 판정 |

### 검색 SC

- **SC-001** (`FR-001` 관련): `SearchService.searchProducts` 가 page/size 를 정규화하여 skip/take 를
  계산한다 — 파라미터 없음 → page1·size20·skip0, page3·size10 → skip20·take10, size 9999 →
  `MAX_SEARCH_SIZE`(100)로 클램핑, sort 기본값 `latest`. [env:unit]

- **SC-002** (`FR-001` 관련): 필터(`q`·`categoryId`·`minPrice`·`maxPrice`·`sort`)가 `ProductService`
  로 그대로 전달되고, 결과가 `{ items, total, page, size }` 메타로 래핑된다. [env:unit]

- **SC-003** (`FR-002`·`NFR-001` 관련): 상품 조회는 `ProductService.searchProducts` DI 경유 read-only
  로 수행되며(search 자체 테이블 없음), `ProductRepository.searchProducts` 가 `ACTIVE`·`OUT_OF_STOCK`
  상태만 노출하고 정렬 tiebreaker 로 `id desc`, 가격 필터를 `Prisma.Decimal` 로 처리한다.
  [env:static] (코드 구조 검증 — `ProductRepository.searchProducts`)

### 알림 SC

- **SC-004** (`FR-003` 관련): `NotificationService.create(userId, type, title, body)` 가
  `repository.create` 에 위임하고 생성된 알림을 반환한다. [env:unit]

- **SC-005** (`FR-004` 관련): `list` 가 page/size 를 정규화하여 skip/take 를 계산하고(기본 page1·
  size20·skip0, page2·size10 → skip10, size 9999 → 100 클램핑) `{ items, total, page, size }` 메타를
  포함한다. [env:unit]

- **SC-006** (`FR-005`·`NFR-004` 관련): `markRead` 가 미존재 알림에 404, 타인 소유 알림에 403, 본인
  소유 알림에 읽음 처리(`markRead` 호출·`isRead:true`)를 수행한다. 403/404 케이스에서는 `markRead`
  repository 호출이 발생하지 않는다. [env:unit]

- **SC-007** (`FR-006` 관련): `markAllRead` 가 `repository.markAllRead(userId)` 에 위임하고
  `{ updated: count }` 를 반환한다. [env:unit]

### 파일 SC

- **SC-008** (`FR-007` 관련): `presign` 이 키 형식 `{purpose}/{userId}/{uuid}` 로 객체 키를 생성하고,
  storage port 를 호출하여 `PENDING`·size0 레코드를 생성하며, 결정적 stub URL(`uploadUrl=
  https://r2.stub.local/{key}?presigned=upload`, `url=https://r2.stub.local/{key}`)을 반환한다. 두 번
  호출 시 키가 서로 다르다(uuid 유일성). [env:unit]

- **SC-009** (`FR-008` 관련): `getById` 가 미존재 파일에 404 를, 존재 파일에 메타를 반환한다.
  [env:unit]

- **SC-010** (`FR-009`·`NFR-004` 관련): `delete` 가 미존재 파일에 404, 타인 소유 파일에 403, 본인
  소유 파일에 삭제(`delete` 호출)를 수행한다. 403/404 케이스에서는 `delete` repository 호출이 발생하지
  않는다. [env:unit]

### 통합·정적 SC

- **SC-011** (`NFR-003` 관련): AppModule 이 `SearchModule`·`NotificationModule`·`FileModule` 을 등록한
  상태로 정상 부팅하며, `GET /search/products` → 200(`{items,total,page,size}`, 공개),
  `GET /notifications`(토큰 없음) → 401, `POST /files/presign`(토큰 없음) → 401, 잘못된 `sort` →
  400(ValidationPipe). [env:integration]

- **SC-053** (`NFR-001` 관련): `notification`·`file` 모듈 Repository 구현 파일이 자신의 소유 스키마 외
  타 도메인 Prisma 모델(`product`·`user`·`seller`·`cart`·`order`·`payment` 등)을 `this.prisma.{model}`
  또는 `this.prisma.tx.{model}` 형태로 직접 참조하지 않는다(`cross-schema.spec.ts` 의
  NotificationRepository(006)·FileRepository(006) 규칙). [env:static]

---

## 요구사항 구조화 매트릭스

> 매핑 누락(SC 없는 FR/NFR, FR/NFR 없는 SC) 0건이 완료 조건.
> MoSCoW: Must / Should / Could / Won't

| US-ID | FR-ID | NFR-ID | SC-ID | [env:*] | MoSCoW |
|---|---|---|---|---|---|
| US-001 | FR-001 | NFR-003 | SC-001, SC-002 | unit | Must |
| US-001 | FR-002 | NFR-001 | SC-003 | static | Must |
| US-004 | FR-003 | — | SC-004 | unit | Must |
| US-002 | FR-004 | NFR-003 | SC-005 | unit | Must |
| US-003 | FR-005 | NFR-004 | SC-006 | unit | Must |
| US-003 | FR-006 | — | SC-007 | unit | Must |
| US-005 | FR-007 | NFR-002 | SC-008 | unit | Must |
| US-005 | FR-008 | NFR-003 | SC-009 | unit | Must |
| US-006 | FR-009 | NFR-004 | SC-010 | unit | Must |
| — | — | NFR-003 | SC-011 | integration | Must |
| — | — | NFR-001 | SC-053 | static | Must |

> NFR-002(외부 의존 금지)는 SC-008(stub 결정적 URL 단위 검증)과 [범위 외](#범위-외)·연구문서의 신규
> 의존 0건 확인으로 충족한다. NFR-005(금전 필드 부재)는 데이터 모델(`notifications`·`file_assets` 금전
> 필드 0)로 충족하며 별도 SC 없음(부재가 곧 상태).

---

## 권한 평가 결과 (PATCH-001)

> 검색·알림·파일 엔드포인트에 대해 인가 3축(호출자 신원·자원 소유권·역할) 평가.

| 엔드포인트 | 위험도 | (a) 호출자 신원 | (b) 자원 소유권 | (c) 역할 | 대응 SC |
|---|---|---|---|---|---|
| `GET /search/products` | 낮음 | 없음(공개) | — (read-only, ACTIVE·OUT_OF_STOCK 한정) | — | SC-001·002·003·011 |
| `GET /notifications` | 낮음 | JWT | `user.userId` 본인 목록만(`listByUser`) | — | SC-005·011 |
| `PATCH /notifications/:id/read` | 중간 | JWT | `notification.userId === me`(불일치 403) | — | SC-006 |
| `PATCH /notifications/read-all` | 낮음 | JWT | `updateMany where userId=me` 본인만 | — | SC-007 |
| `POST /files/presign` | 중간 | JWT | 키에 `userId` 바인딩, `ownerId=me` 레코드 생성 | — | SC-008·011 |
| `GET /files/:id` | 낮음~중간 | JWT | **없음 — 임의 인증 사용자에게 메타 노출(SEC-FIND-006-01)** | — | SC-009 |
| `DELETE /files/:id` | 중간 | JWT | `file.ownerId === me`(불일치 403) | — | SC-010 |

**잠재 위험 기록 (허용·기록):**
- **`GET /files/:id` 소유권 미검증(Low, SEC-FIND-006-01)**: 파일 메타(`key`·`url`·`ownerId`·
  `contentType`)가 소유권/인가 검증 없이 임의 인증 사용자에게 노출된다. 공개 URL 모델(`publicUrl`
  반환)과는 정합하나 메타 스코핑이 없다. 비공개 purpose 도입 시 `ownerId` 검증 또는 공개/비공개 구분
  필요. admin/비인증이 아닌 임의 인증 사용자 범위이고 현재 모든 파일이 public URL 모델이므로 허용·기록.
- **presign 입력 무검증(Low, SEC-FIND-006-02)**: `contentType` 을 클라이언트 입력 그대로 수용(허용
  MIME allowlist 부재), 파일 크기 상한 미적용(`size=0` placeholder). 실제 R2 presign 전환 시
  content-type 바인딩·크기 제한 필요. 현재 stub 모델(무네트워크)에서는 악용 표면이 제한적이므로
  허용·기록.

---

## 범위 외

- **실제 R2(객체 스토리지) 연동**: `FileStoragePort` 의 실제 구현체(presigned URL 서명·R2 SDK 호출).
  본 spec 은 `StubFileStorage`(결정적 URL, 무네트워크)까지만. 실제 전환 시 content-type 바인딩·크기
  제한·서명 검증 추가(SEC-FIND-006-02).
- **파일 업로드 확정(confirm)**: `FileStatus.PENDING → UPLOADED` 전이 엔드포인트 부재. 클라이언트가
  presigned URL 로 PUT 한 후 상태·size 를 갱신할 경로가 없어 고아 PENDING 레코드가 누적될 수 있다
  (GAP-006-02). 후속 spec.
- **알림 도메인 이벤트 연동**: `NotificationService.create()` 는 공개 진입점만 제공하며, 주문·배송·
  정산·리뷰 이벤트 핸들러에서 실제로 호출하는 연동은 미구현(GAP-006-01). 후속 spec.
- **검색 고급 기능**: 전문 검색(full-text)·형태소 분석·랭킹·추천·검색어 자동완성·facet 집계. 본 spec
  은 `title contains`·카테고리·가격·정렬·offset 페이지네이션까지만.
- **파일 메타 비공개 스코핑**: purpose 별 공개/비공개 접근 정책 분기(SEC-FIND-006-01). 후속 spec.

---

## 미결 사항

없음 — 본 spec 은 구현 완료 코드를 기준으로 retroactive 작성되었으며, 모든 요구사항·수용 기준이 실제
구현과 대조 확인되었다. 식별된 공백은 [범위 외](#범위-외) 및 `gaps.md`(GAP-006-01·02,
SEC-FIND-006-01·02)에 기록한다.
