---
작성: Spec Agent
버전: v1.0
최종 수정: 2026-06-29 17:50
상태: 확정 (retroactive)
---

# Spec Input: 006-search-notification-file
> 수집 일시: 2026-06-29 | 맥락: 경량 모드 백엔드 진행 → 정식 SDD 문서화

## 수집 진행 상태

| 카테고리 | 상태 | 답변 완료 항목 |
|---|---|---|
| 1. 배경 및 목적 | 완료 | [Q1, Q2, Q3] |
| 2. 사용자 & 이해관계자 | 완료 | [Q4, Q5] |
| 3. 핵심 기능 | 완료 | [Q-A~E] |
| 4. 데이터 & 입출력 | 완료 | [Q-F, Q-G] |
| 5. 제약조건 | 완료 | [Q6, Q7] |
| 6. 예외 & 실패 시나리오 | 완료 | [Q8, Q9] |

## 원 요청 맥락

사용자 지시: **"경량 모드로 나머지 백엔드 진행"** — 003-commerce·004-review-coupon·005-shipping-
settlement 완료 후, 마지막 백엔드 도메인 묶음(검색·알림·파일)을 경량 모드(spec.md 1장으로 요구사항·
수용 기준·구현 결과 통합)로 구현했다. 006 은 검색(search)·알림(notification)·파일(file) 3개 도메인을
하나의 spec 으로 묶었다. 본 문서는 그 경량 산출물을 정식 SDD 포맷으로 보강하기 위한 입력 재구성이다.

## 질문 분석 근거 (Question Analysis Basis)

| 질문 ID | 요지 | 옵션·근거 | 채택 결과 |
|---|---|---|---|
| Q-A | 검색 모듈 데이터 소유 | A:자체 검색 테이블/인덱스 / B:ProductService DI read-only | **B 채택**(P-001 — 자체 테이블 없음, ProductService 경유) |
| Q-B | 검색 페이지네이션 방식 | A:offset(page/size) / B:cursor | **A 채택**(offset, size 클램핑 20/100) |
| Q-C | 검색 노출 상품 상태 | ACTIVE·OUT_OF_STOCK 한정 | **채택**(DRAFT·SUSPENDED 미노출) |
| Q-D | 알림 생성 트리거 | A:create() 공개 진입점만 / B:도메인 이벤트 핸들러 연동까지 | **A 채택**(진입점만, 이벤트 연동 후속 — GAP-006-01) |
| Q-E | 파일 업로드 모델 | A:서버 프록시 업로드 / B:presigned URL 클라이언트 직접 PUT | **B 채택**(서버는 메타만) |
| Q-F | 객체 스토리지 연동 | A:실제 R2 SDK / B:FileStoragePort + Stub(무네트워크) | **B 채택**(P-002, 결정적 URL stub) |
| Q-G | 파일 상태 확정 | presign 시 PENDING, UPLOADED 전이 엔드포인트 | **PENDING 까지만**(confirm 후속 — GAP-006-02) |

## 카테고리별 수집 내용

### [카테고리 1] 배경 및 목적

Q1. 왜 만드는가?
- 구매자가 키워드·카테고리·가격·정렬로 상품을 탐색하는 공개 검색 진입점 부재(002 카탈로그는 조회만).
- 도메인 이벤트를 사용자에게 전달할 알림 저장·조회 경로 부재.
- 상품·리뷰·프로필 이미지 업로드를 위한 파일 메타데이터 관리 경로 부재.

Q2. 현재 어떻게?
- 미구현. search·notification·file 모듈은 빈 스텁(골격만).

Q3. 성공 판단 기준
- `GET /search/products` 가 필터·정렬·페이지네이션으로 ACTIVE·OUT_OF_STOCK 상품을 반환한다.
- 사용자가 본인 알림을 미읽음 우선·최신순 조회하고 개별/전체 읽음 처리한다(타인 차단).
- `POST /files/presign` 이 결정적 stub URL + PENDING 메타 레코드를 발급한다.

### [카테고리 2] 사용자 & 이해관계자

Q4. 사용자 역할
- 구매자(비인증 포함): 상품 검색.
- 인증 사용자: 알림 조회·읽음 처리, 파일 presign·조회·삭제.
- 타 도메인 서비스(주문·배송·정산·리뷰): 알림 생성 진입점(`create()`) 소비자(현재 미연동).

Q5. 이해관계자
- 프런트엔드: 검색 결과·알림 뱃지·파일 업로드 UI 의 직접 소비자.
- 객체 스토리지(R2): 파일 바이너리 저장소(현재 stub 추상화).

### [카테고리 3] 핵심 기능

**검색 Must:**
- 공개 상품 검색(q·categoryId·minPrice·maxPrice·sort·page·size, items+total+page+size).
- ProductService DI read-only(P-001), ACTIVE·OUT_OF_STOCK 한정, tiebreaker id desc.

**알림 Must:**
- create() 공개 진입점, list(미읽음 우선·최신순·페이지네이션), markRead(본인), markAllRead(본인).

**파일 Must:**
- presign(PENDING 레코드 + key {purpose}/{userId}/{uuid} + 결정적 URL), getById, delete(본인).

**제외(Out of Scope):**
- 실제 R2 SDK 연동, 파일 UPLOADED confirm, 알림 이벤트 연동, 전문 검색/랭킹, 파일 비공개 스코핑.

### [카테고리 4] 데이터 & 입출력

**알림 데이터(users 스키마):**
- notification: userId(plain String), type(NotificationType), title, body, isRead(default false), createdAt. index(userId, isRead, createdAt desc).

**파일 데이터(files 스키마):**
- file_assets: ownerId(plain String), purpose(FilePurpose), key(@unique), url, contentType, size(default 0), status(FileStatus default PENDING), createdAt. index(ownerId, createdAt desc).

**검색(소유 테이블 없음):**
- 상품 조회는 `ProductService.searchProducts` DI 경유. products 스키마 read-only.

**연동(P-001 DI 경계):**
- 검색: `ProductService.searchProducts` / `ProductRepository.searchProducts`(006 신규).
- 파일 스토리지: `FileStoragePort`(stub) — `FILE_STORAGE` DI 토큰.

### [카테고리 5] 제약조건

Q6. 기술 스택 제약
- P-001: search 자체 테이블 없음(ProductService DI). notification/file Repository 는 자기 소유 테이블만. cross-schema plain String(FK 미선언).
- P-002: 신규 npm 의존 0. R2 연동 FileStoragePort + Stub(무네트워크).
- P-005 해당 없음: 006 신규 테이블에 금전 필드 없음.

Q7. 성능: 특별한 P95 수치 제약 없음. 검색·알림 조회는 인덱스 설계(DB Design 담당)로 충족.

### [카테고리 6] 예외 & 실패 시나리오

Q8. 실패 시 동작
- 잘못된 sort → 400(ValidationPipe). 인증 없는 알림/파일 요청 → 401.
- 타인 알림 읽음/파일 삭제 → 403. 미존재 알림/파일 → 404.

Q9. 엣지 케이스
- size 초과 입력 → MAX(100) 클램핑. page<1 → 1.
- presign 동일 입력 2회 → uuid 로 키 유일.
- `GET /files/:id` 소유권 미검증(SEC-FIND-006-01, 허용·기록).
- presign contentType/크기 무검증(SEC-FIND-006-02, stub 모델 한정 허용).
- 알림 create() 진입점만 — 실제 이벤트 미연동(GAP-006-01). PENDING confirm 부재(GAP-006-02).
