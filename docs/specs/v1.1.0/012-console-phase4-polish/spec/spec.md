---
작성: Spec Agent
버전: v1.0
최종 수정: 2026-06-30
상태: 확정
---

# Spec: 012-console-phase4-polish

> Branch: 012-console-phase4-polish | Date: 2026-06-30 | Version: v1.1.0

## 목차

- [배경 및 목적](#배경-및-목적)
- [선행 spec 영향 추적](#선행-spec-영향-추적-predecessor-lineage)
- [사용자 스토리](#사용자-스토리)
- [기능 요구사항](#기능-요구사항-fr)
- [비기능 요구사항](#비기능-요구사항-nfr)
- [수용 기준](#수용-기준-sc)
- [요구사항 구조화 매트릭스](#요구사항-구조화-매트릭스)
- [범위 외](#범위-외)

---

## 배경 및 목적

v1.1.0 프론트엔드 사이클의 Phase 4 — 콘솔 마감 차수. Phase 1(판매자 주문·배송)·Phase 2(판매자 운영)·Phase 3(관리자 운영) 완료 후 남은 공통 GAP 항목을 해소하여 콘솔을 릴리즈 가능 수준으로 완성한다.

해소 대상 4가지:

1. **파일 업로드 UX 미구현**: 상품 이미지·배너 이미지 등록 시 URL 직접 입력만 가능. 백엔드 files 모듈(`POST /files/presign`, `POST /files/:id/confirm`)이 이미 존재하나 프론트엔드 업로드 플로우가 없다.

2. **역할별 라우트 권한 가드 미정비**: `apps/console/lib/auth.tsx`에서 `isAdmin`이 `false`로 하드코딩되어 있고(`GET /auth/me` 응답에 isAdmin 필드 부재), 관리자 메뉴가 비관리자에게 노출되는 UX 결함이 존재한다(GAP-007-01).

3. **에러·로딩·빈상태 표준 컴포넌트 부재**: 페이지별 ad-hoc 방식으로 일관성이 없다.

4. **E2E 자동화 테스트 없음**: Playwright 미설치. 주요 사용자 플로우 회귀 탐지가 불가능하다.

---

## 선행 spec 영향 추적 (Predecessor Lineage)

| 선행 spec | 식별된 결함 항목 | 결함 인지 시점 | 식별 경로 |
|---|---|---|---|
| v1.1.0/007-admin-console | GAP-007-01: isAdmin 하드코딩 false — admin 메뉴가 비관리자에게 노출되는 UX 결함 | 2026-06-30 | CHANGES.md GAP-007-01 (2) 후속 권고 |

---

## 사용자 스토리

- **US-001**: 판매자로서, 상품 이미지를 안전하게 업로드하여 상품에 연결하고 싶다.
- **US-002**: 관리자로서, 배너 이미지를 업로드하여 배너를 생성하고 싶다.
- **US-003**: 관리자로서, 관리자 권한이 없는 사용자가 관리자 화면에 접근하지 못하게 하고 싶다.
- **US-004**: 사용자(판매자·관리자)로서, 로딩·에러·빈상태를 일관된 UI로 보고 싶다.
- **US-005**: 개발팀으로서, 주요 사용자 플로우(로그인, 역할별 화면 접근)가 E2E 자동화 테스트로 검증되기를 바란다.

---

## 기능 요구사항 (FR)

### 백엔드 변경

- **FR-001**: `GET /auth/me` 응답(`AuthProfileResponse`)에 `isAdmin: boolean` 필드를 추가한다. 해당 필드는 현재 사용자의 ID가 `ADMIN_USER_IDS` 환경변수(콤마 구분 문자열)에 포함되면 `true`, 아니면 `false`로 결정된다.

### 파일 업로드 공용 컴포넌트

- **FR-002**: `<ImageUpload>` 공용 컴포넌트를 구현한다. 사용자가 이미지 파일을 선택하면 `POST /files/presign` → 클라이언트 직접 PUT(presigned URL) → `POST /files/:id/confirm`의 3단계 흐름을 실행하고 완료된 파일의 public URL을 호출자에게 반환한다.

### 상품 이미지 관리

- **FR-003**: `/seller/products/[id]` 상품 상세 페이지에 이미지 관리 섹션을 추가한다. 현재 연결된 이미지 목록(최대 10장)을 표시하고, 이미지 추가(`<ImageUpload>` → `POST /products/:id/images`) 및 개별 이미지 삭제(`DELETE /products/:id/images/:imageId`)를 지원한다.

### 배너 이미지 업로드

- **FR-004**: `/admin/banners` 배너 생성 다이얼로그(CreateBannerDialog)의 `imageUrl` 텍스트 입력 필드를 `<ImageUpload>` 컴포넌트로 교체한다. 업로드 완료된 파일의 public URL이 `imageUrl` 값으로 사용된다.

### 역할별 권한 가드

- **FR-005**: `apps/console/lib/auth.tsx`에서 `isAdmin`을 `false` 하드코딩 대신 `GET /auth/me` 응답의 `isAdmin` 필드 값으로 결정한다.
- **FR-006**: Next.js `middleware.ts`를 도입하여 인증되지 않은 사용자의 보호된 경로 접근 시 `/login`으로 리다이렉트하고, 비관리자의 `/admin/*` 경로 접근을 서버 사이드에서 차단한다.
- **FR-007**: 대시보드 네비게이션에서 관리자 전용 항목을 `isAdmin=false` 사용자에게 숨긴다(GAP-007-01 해소).

### 표준 상태 컴포넌트

- **FR-008**: `<ErrorState>`, `<LoadingState>`, `<EmptyState>` 공용 컴포넌트를 생성한다.
- **FR-009**: 이번 스펙에서 변경되는 페이지(상품 상세 이미지 섹션, 배너 생성 다이얼로그)에 표준 컴포넌트를 적용한다.

### Playwright E2E 스모크

- **FR-010**: `@playwright/test` 패키지를 설치하고 E2E 테스트 실행 설정 파일을 구성한다.
- **FR-011**: 로그인, 판매자 상품 목록 접근, 관리자 배너 목록 접근, 비인증 접근 차단의 4개 E2E 스모크 시나리오를 구현한다.

---

## 비기능 요구사항 (NFR)

- **NFR-001**: FR-001 백엔드 변경에 의한 기존 백엔드 테스트 261개 전량 회귀 없이 PASS 유지. 신규 단위 테스트 추가 필요.
- **NFR-002**: 클라이언트 측 파일 유효성 기준 — 허용 MIME 타입: `image/jpeg`, `image/png`, `image/webp`, `image/gif` / 최대 크기: 10MiB(10,485,760 bytes). 백엔드 `ALLOWED_CONTENT_TYPES`·`MAX_FILE_SIZE_BYTES` 와 동일 기준 적용.
- **NFR-003**: 파일 업로드 3단계(presign·PUT·confirm) 중 어느 단계에서도 실패 시 사용자에게 명시적 오류 메시지를 표시한다(silent fail 금지).
- **NFR-004**: 관리자 전용 라우트(`/admin/*`)는 Next.js middleware 레벨에서 비관리자 접근을 서버 사이드 차단한다. 백엔드 AdminGuard가 최종 방어선이며, middleware는 추가 UX 보호 계층이다.
- **NFR-005**: Playwright 스모크 테스트(4개 시나리오 전체) 실행 완료 시간 2분 이내.

---

## 수용 기준 (SC)

### FR-001 — 백엔드 isAdmin 필드

- **SC-001** (`FR-001` 관련): `GET /auth/me` 응답 JSON에 `isAdmin: boolean` 필드가 포함된다. [env:unit]
- **SC-002** (`FR-001` 관련): `ADMIN_USER_IDS` 환경변수에 포함된 user ID로 호출 시 `isAdmin: true`를 반환하고, 미포함 시 `isAdmin: false`를 반환한다. [env:unit]
- **SC-003** (`FR-001`, `NFR-001` 관련): FR-001 변경 후 기존 백엔드 테스트 261개 전량 PASS하고, SC-001·SC-002를 검증하는 신규 단위 테스트가 추가된다. [env:unit]

### FR-002 — ImageUpload 컴포넌트

- **SC-004** (`FR-002` 관련): `<ImageUpload>` 컴포넌트가 파일 선택 시 `POST /files/presign` → presigned URL로 PUT → `POST /files/:id/confirm` 순서로 3단계 요청을 실행한다. [env:unit]
- **SC-005** (`FR-002`, `NFR-002` 관련): 허용 MIME 타입 외 파일 또는 10MiB 초과 파일 선택 시 presign 요청 없이 오류 메시지를 표시한다. [env:unit]
- **SC-006** (`FR-002`, `NFR-003` 관련): presign·PUT·confirm 각 단계 실패 시 해당 단계 오류 메시지를 표시한다. [env:unit]

### FR-003 — 상품 이미지 관리

- **SC-007** (`FR-003` 관련): `/seller/products/[id]` 페이지에 이미지 섹션이 존재하며 현재 연결된 이미지 목록이 표시된다. [env:integration]
- **SC-008** (`FR-003` 관련): 이미지 업로드 완료 후 `POST /products/:id/images { url, displayOrder }`가 호출되어 이미지가 상품에 연결된다. [env:integration]
- **SC-009** (`FR-003` 관련): 이미지 삭제 버튼 클릭 시 `DELETE /products/:id/images/:imageId`가 호출된다. [env:integration]
- **SC-010** (`FR-003` 관련): 연결된 이미지가 이미 10장인 경우 추가 업로드 버튼이 비활성화된다. [env:unit]

### FR-004 — 배너 이미지 업로드

- **SC-011** (`FR-004` 관련): 배너 생성 폼의 imageUrl 입력 영역이 `<ImageUpload>` 컴포넌트로 구성된다. [env:static]
- **SC-012** (`FR-004` 관련): 배너 생성 요청 시 업로드 완료된 파일의 public URL이 `imageUrl` 값으로 전송된다. [env:integration]

### FR-005 — auth.tsx isAdmin

- **SC-013** (`FR-005` 관련): `lib/auth.tsx`의 `isAdmin`이 `false` 하드코딩 대신 `GET /auth/me` 응답의 `isAdmin` 필드 값을 사용한다. [env:static]

### FR-006 — 미들웨어 라우트 가드

- **SC-014** (`FR-006` 관련): `middleware.ts`가 `apps/console/` 하위에 존재하며 보호 경로 패턴이 설정되어 있다. [env:static]
- **SC-015** (`FR-006`, `NFR-004` 관련): 비인증 상태에서 보호된 경로 접근 시 `/login`으로 리다이렉트가 발생한다. [env:e2e-docker]
- **SC-016** (`FR-006`, `NFR-004` 관련): `isAdmin=false` 사용자가 `/admin/*` 경로 접근 시 차단(403 응답 또는 `/login` 리다이렉트)이 발생한다. [env:e2e-docker]

### FR-007 — 네비게이션 권한 필터

- **SC-017** (`FR-007` 관련): `isAdmin=false` 상태에서 대시보드 네비게이션에 관리자 전용 항목이 표시되지 않는다. [env:unit]

### FR-008 — 표준 컴포넌트 생성

- **SC-018** (`FR-008` 관련): `<ErrorState>`, `<LoadingState>`, `<EmptyState>` 컴포넌트 파일이 `apps/console/components/` 하위에 존재한다. [env:static]

### FR-009 — 표준 컴포넌트 적용

- **SC-019** (`FR-009` 관련): 이번 스펙에서 변경되는 페이지(상품 상세 이미지 섹션, 배너 생성 다이얼로그)에서 로딩·에러·빈상태가 각각 표준 컴포넌트로 표시된다. [env:integration]

### FR-010 — Playwright 설치

- **SC-020** (`FR-010` 관련): `@playwright/test`가 `devDependencies`에 존재하고 `playwright.config.ts`가 존재한다. [env:static]

### FR-011 — E2E 스모크 시나리오

- **SC-021** (`FR-011` 관련): 유효한 이메일·비밀번호로 `/login` 접근 → 대시보드 리다이렉트가 성공한다. [env:e2e-docker]
- **SC-022** (`FR-011` 관련): 판매자 계정으로 `/seller/products` 페이지 접근이 성공한다(페이지 요소 확인). [env:e2e-docker]
- **SC-023** (`FR-011` 관련): 관리자 계정으로 `/admin/banners` 페이지 접근이 성공한다. [env:e2e-docker]
- **SC-024** (`FR-011` 관련): 비인증 상태에서 보호된 경로 접근 시 `/login`으로 리다이렉트가 발생한다. [env:e2e-docker]
- **SC-025** (`NFR-005` 관련): SC-021~SC-024 전체 실행 완료 시간이 2분 이내다. [env:e2e-docker]

---

## 요구사항 구조화 매트릭스

> 매핑 누락(SC 없는 FR/NFR, FR/NFR 없는 SC) 0건이 완료 조건.

| US-ID | FR-ID | NFR-ID | SC-ID | [env:*] | MoSCoW |
|---|---|---|---|---|---|
| US-003 | FR-001 | NFR-001 | SC-001 | unit | Must |
| US-003 | FR-001 | NFR-001 | SC-002 | unit | Must |
| US-003 | FR-001 | NFR-001 | SC-003 | unit | Must |
| US-001, US-002 | FR-002 | NFR-002, NFR-003 | SC-004 | unit | Must |
| US-001, US-002 | FR-002 | NFR-002 | SC-005 | unit | Must |
| US-001, US-002 | FR-002 | NFR-003 | SC-006 | unit | Must |
| US-001 | FR-003 | — | SC-007 | integration | Must |
| US-001 | FR-003 | — | SC-008 | integration | Must |
| US-001 | FR-003 | — | SC-009 | integration | Must |
| US-001 | FR-003 | — | SC-010 | unit | Must |
| US-002 | FR-004 | — | SC-011 | static | Must |
| US-002 | FR-004 | — | SC-012 | integration | Must |
| US-003 | FR-005 | — | SC-013 | static | Must |
| US-003, US-004 | FR-006 | NFR-004 | SC-014 | static | Must |
| US-003, US-004 | FR-006 | NFR-004 | SC-015 | e2e-docker | Must |
| US-003, US-004 | FR-006 | NFR-004 | SC-016 | e2e-docker | Must |
| US-003 | FR-007 | — | SC-017 | unit | Should |
| US-004 | FR-008 | — | SC-018 | static | Should |
| US-004 | FR-009 | — | SC-019 | integration | Should |
| US-005 | FR-010 | — | SC-020 | static | Must |
| US-005 | FR-011 | NFR-005 | SC-021 | e2e-docker | Must |
| US-005 | FR-011 | NFR-005 | SC-022 | e2e-docker | Must |
| US-005 | FR-011 | NFR-005 | SC-023 | e2e-docker | Must |
| US-005 | FR-011 | NFR-005 | SC-024 | e2e-docker | Must |
| US-005 | — | NFR-005 | SC-025 | e2e-docker | Should |

---

## 범위 외

- **파일 업로드 E2E**: Playwright 파일 업로드 시나리오는 stub 환경(StubFileStorage) 구성 복잡도를 고려하여 범위 외. 파일 업로드 플로우는 단위·통합 테스트(SC-004~SC-006)로 검증한다.
- **배너 편집(UpdateBanner) 이미지 연결**: 배너 편집 다이얼로그 UI가 미구현(GAP-007-01 (3)) 상태이므로 범위 외. 배너 생성(CreateBannerDialog)만 포함(FR-004).
- **DELETE /files/:id 연동**: 상품 이미지 삭제 시 `product_images` 레코드만 삭제. R2 바이너리 삭제(파일 완전 삭제)는 운영 정책 결정 후 별도 spec.
- **기존 미변경 페이지 표준 컴포넌트 소급**: 변경 페이지(상품 상세 이미지 섹션, 배너 생성 다이얼로그)에만 적용(FR-009). 나머지 기존 페이지는 현행 유지.
- **Playwright CI 자동화**: 로컬 실행 전용. CI 파이프라인 통합은 별도 인프라 작업.
- **이미지 업로드 진행률 표시 / drag-and-drop 재정렬**: 추후 UX 개선으로 defer.
- **비승인 판매자 seller 라우트 접근 처리**: 기존 `isSeller` 분기 처리 유지 (변경 없음).

### 사후 운영 검증 피드백 사이클 (PROC-014)

파이프라인 종료 후 운영 환경에서 점검이 필요한 시나리오:
1. `StubFileStorage` → 실 R2 전환 시 presigned URL 형식 차이로 클라이언트 PUT 실패 가능성
2. `ADMIN_USER_IDS` 환경변수 미설정 시 모든 사용자 `isAdmin=false` — middleware가 `/admin/*` 전체 차단

사후 결함 발견 시 처리: 결함 정보를 다음 spec 입력으로 사용 → main session `spec 수정` 이벤트 → 1단계 재진입.

모니터링: Phase 4 배포 직후 수동 검증 권고 — 관리자 로그인 → 배너 생성(이미지 업로드) → 상품 상세 이미지 업로드·삭제 시나리오 각 1회 실행.
