---
작성: Spec Agent
버전: v1.0
최종 수정: 2026-06-30
상태: 확정
---

# Spec Input: 012-console-phase4-polish

> 수집 일시: 2026-06-30 | 사용자 최종 확인: 완료 (2026-06-30)

## 수집 진행 상태

| 카테고리 | 상태 | 마지막 질문 번호 | 답변 완료 항목 |
|---|---|---|---|
| 1. 배경 및 목적 | 완료 | Q3 | [Q1, Q2, Q3] |
| 2. 사용자 & 이해관계자 | 완료 | Q6 | [Q4, Q5, Q6] |
| 3. 핵심 기능 | 완료 | Q9 | [Q7, Q8, Q9, QA-1, QA-2, QA-3, QA-4] |
| 4. 데이터 & 입출력 | 완료 | Q12 | [Q10, Q11, Q12] |
| 5. 제약조건 | 완료 | Q16 | [Q13, Q14, Q15, Q16] |
| 6. 운영 환경 | 완료 | Q19 | [Q17, Q18, Q19] |
| 7. 예외 & 실패 시나리오 | 완료 | Q22 | [Q20, Q21, Q22] |

## 기존 working tree 수정 통합

`git diff HEAD --stat` 기준 수정된 파일:
- `apps/backend/package.json` — pino-pretty ^13.1.3 devDep 추가 (011-backend-cors-dev-logging 미커밋)
- `apps/backend/src/main.ts` — CORS enablement 추가 (011-backend-cors-dev-logging 미커밋)
- `pnpm-lock.yaml` — pino-pretty lock 갱신 (011-backend-cors-dev-logging 미커밋)
- `docs/specs/v1.1.0/010-backend-response-schemas/` — untracked SDD 산출물 폴더

**통합 결정**: 이 변경들은 011-backend-cors-dev-logging의 미커밋 작업으로, 본 spec(012) 범위 외. 별도 커밋으로 처리한다.

## 질문 분석 근거 (Question Analysis Basis)

| 질문 ID | 요지 | 옵션별 근거·trade-off | 추천안(이유) | 채택 결과 |
|---|---|---|---|---|
| QA-1 | isAdmin 감지 방법 | A: BE 변경(GET /auth/me에 isAdmin 추가) — 명확하나 백엔드 변경 필요. B: 프론트 전용(middleware JWT 디코드 + env 변수 비교) — 백엔드 무변경이나 보안 낮음(UI 필터 수준). C: 현재 유지(관리자 메뉴 모두 노출, 403 graceful 처리) — 가장 적은 작업이나 UX 결함 지속. | A — auth.tsx 주석이 "추후 isAdmin 노출 시 대체" 명시. 이번 마감 차수에 해소하는 것이 자연스럽다. 백엔드 변경 최소(service 1줄). | **A 채택** — GET /auth/me 응답에 isAdmin 필드 추가. AuthProfileResponse DTO + AuthService ADMIN_USER_IDS 비교. 본 스펙에 백엔드 변경 포함. |
| QA-2 | 상품 이미지 UX | A: 단일 이미지(1장) — 심플. B: 다중 이미지(최대 10장) — 백엔드 최대 10장 지원, 업로드 목록+삭제 필요. | B — 백엔드가 이미 다중 지원. 판매자 상품은 여러 이미지가 UX 기본값이다. | **B 채택** — 다중 이미지(최대 10장). 이미지 목록 표시 + 개별 삭제. POST/DELETE /products/:id/images 활용. |
| QA-3 | Playwright 스모크 범위 | A: 최소(로그인만). B: 중간(로그인+판매자+관리자 화면 접근). C: 파일 업로드 포함(백엔드 mock 필요). | B — Phase 4 목적에 부합. 핵심 경로(로그인, 역할별 화면 접근) 자동 회귀 방지. C는 stub 환경 구성 복잡도가 높다. | **B 채택** — 로그인 + 판매자·관리자 화면 접근 3~4개 시나리오. 파일 업로드 E2E는 범위 외. |
| QA-4 | 표준 컴포넌트 소급 범위 | A: 신규 생성만. B: 전체 소급. C: 이번 변경 페이지만 선택 소급. | C — 범위를 통제하면서도 새로 다루는 화면의 일관성을 확보. 전체 소급은 변경 라인 과다. | **C 채택** — 선택적 소급. 이번 스펙에서 변경하는 페이지만 적용. 기존 미변경 페이지는 현행 유지. |

## 카테고리별 수집 내용

### [카테고리 1] 배경 및 목적

**Q1. 왜 만드는가**:
v1.1.0 프론트엔드 사이클의 Phase 4 — 콘솔 마감 차수. Phase 1(판매자 주문·배송)·Phase 2(판매자 운영)·Phase 3(관리자 운영) 완료 후 남은 4가지 공통 GAP 항목을 해소하여 콘솔을 릴리즈 가능 수준으로 마무리한다.

**Q2. 현재 한계**:
- 파일 업로드 UX 없음 — 상품 이미지·배너 이미지 등록 시 URL 직접 입력만 가능. presign→PUT→confirm 흐름 미구현.
- 역할별 라우트 권한 가드 미정비 — admin 메뉴가 비관리자에게 노출됨(GAP-007-01 (2)). isAdmin 항상 false.
- 에러·로딩·빈상태 처리가 페이지별 ad-hoc 방식 — 일관성 부재.
- E2E 자동화 테스트 없음 — 회귀 탐지 불가.

**Q3. 성공 기준**:
- 파일 업로드 3단계(presign→PUT→confirm) 완성, 상품·배너에 연결됨
- 역할별 메뉴/라우트 가드 적용 (GAP-007-01 해소)
- 표준 에러·로딩·빈상태 컴포넌트 생성 및 변경 페이지 적용
- Playwright 스모크 테스트 통과(로그인 + 핵심 화면 접근)

### [카테고리 2] 사용자 & 이해관계자

**Q4. 사용자**:
- 판매자(Seller): 상품 등록/관리, 주문 처리, 정산 확인. APPROVED 상태 필요.
- 관리자(Admin): 플랫폼 운영, 판매자 승인, 배너 관리. ADMIN_USER_IDS env로 판별.
- 두 역할 모두 `apps/console` 단일 앱 사용.

**Q5. 기술 수준**: 내부 운영자 수준. 상세한 UX 안내 불필요.

**Q6. 이해관계자**: 판매자(수익 확인), 관리자(플랫폼 운영), 개발팀(배포 준비).

### [카테고리 3] 핵심 기능

**Q7. 필수 기능 (우선순위 순)**:
1. 파일 업로드 UX — `<ImageUpload>` 컴포넌트(presign→PUT→confirm 3단계)
   - 판매자 상품 이미지: `/seller/products/[id]` 페이지 이미지 섹션 추가 (다중, 최대 10장, 개별 삭제)
   - 관리자 배너 이미지: `/admin/banners` 생성 다이얼로그의 imageUrl 입력 대체
2. 역할별 라우트 권한 가드 — GET /auth/me isAdmin 필드 추가(백엔드), auth.tsx 반영, middleware.ts 도입, admin 메뉴 필터
3. 표준 공통 컴포넌트 — `<ErrorState>`, `<LoadingState>`, `<EmptyState>` (변경 페이지 적용)
4. Playwright E2E 스모크 — 설치 + 로그인/판매자/관리자 화면 3~4개 시나리오

**Q8. 있으면 좋지만 필수 아닌 것**:
- 상품 이미지 drag-and-drop 재정렬
- 이미지 미리보기 크롭/편집
- 이미지 업로드 진행률 표시

**Q9. 명시적 Out of Scope**:
- 파일 업로드 E2E Playwright 시나리오 (stub 환경 구성 복잡도)
- 배너 편집(UpdateBanner) 다이얼로그 이미지 연결 (편집 UI 미구현 — GAP-007-01 (3))
- DELETE /files/:id 연동 (이미지 삭제 시 product_images 레코드만 삭제)
- Playwright CI 자동 실행 (로컬 실행만)
- 기존 미변경 페이지 표준 컴포넌트 소급 (선택적 소급만)

### [카테고리 4] 데이터 & 입출력

**Q10. 주요 데이터**:
- `FileAsset` (file_assets 테이블): id, ownerId, purpose, key, url, contentType, size, status (PENDING→UPLOADED)
- `ProductImage` (product_images 테이블): id, productId, url, displayOrder
- `Banner` (banners 테이블): id, title, imageUrl(단일 URL), linkUrl, position, isActive 등

**Q11. 외부 연동**:
- 백엔드 files API (이미 존재): POST /files/presign, GET /files/:id, POST /files/:id/confirm
- 백엔드 product images API (이미 존재): POST /products/:id/images, DELETE /products/:id/images/:imageId
- 백엔드 banners API (이미 존재): POST /admin/banners
- 백엔드 auth API (변경 예정): GET /auth/me에 isAdmin 필드 추가
- R2 (Cloudflare) presigned URL로 직접 PUT (현재 StubFileStorage — 결정적 URL 반환)

**Q12. 데이터 민감도**: 이미지 파일. 개인정보·결제정보 없음.

**Q12-1. 이미지 표현**: presign 응답 `url` 필드가 R2 공개 URL. confirm 후 동일 URL 사용. 별도 요약/미리보기 불필요.

### [카테고리 5] 제약조건

**Q13. 기술 스택 제약**:
- Next.js 15 App Router (apps/console)
- React Query (TanStack Query v5) — 기존 패턴 유지
- @doa/ui 컴포넌트 재사용
- 파일 MIME: image/jpeg, image/png, image/webp, image/gif만 허용 (ALLOWED_CONTENT_TYPES)
- 파일 최대 크기: 10MiB / 10,485,760 bytes (MAX_FILE_SIZE_BYTES)
- P-002: AWS SDK 미사용 (R2는 presign URL 기반 직접 PUT)

**Q14. 일정**: Phase 4 단일 차수로 완결.

**Q15. 성능 요구사항**:
- 이미지 업로드 중 UI 블로킹 없음 (비동기 처리)
- Playwright 스모크 테스트 4개 시나리오 전체 실행 2분 이내

**Q16. 보안**:
- presign 요청은 인증 필수 (JwtAuthGuard 이미 적용)
- confirm 요청도 인증 필수 (소유자 검증 이미 적용)
- admin 라우트는 백엔드 AdminGuard가 최종 강제 (UI middleware는 추가 보호 계층)

### [카테고리 6] 운영 환경

**Q17. 실행 환경**: Fly.io Docker 컨테이너. 로컬 개발: `next dev -p 3100`.

**Q18. 예상 규모**: 내부 운영자 수준 (소수 판매자·관리자). 확장성 요구 없음.

**Q19. 배포·운영 담당**: 개발팀. CORS_ORIGIN, NEXT_PUBLIC_API_URL, ADMIN_USER_IDS(백엔드) 환경변수 관리.

배포 환경 cross-reference: Playwright E2E는 로컬 실행 전용 (CI 자동화 범위 외). 파일 업로드는 StubFileStorage 기반이므로 실 R2 연동 없음.

### [카테고리 7] 예외 & 실패 시나리오

**Q20. 시스템 실패 시**:
- presign 실패 → 에러 메시지 표시 후 재시도 가능
- PUT 업로드 실패(네트워크) → 에러 메시지 표시
- confirm 실패 → 에러 메시지 표시 (파일은 R2에 올라갔으나 PENDING 상태 유지)
- 401 응답 → 자동 /login 리다이렉트 (기존 onAuthExpired 처리)
- 403 응답 (admin 비인가) → 에러 메시지 표시 (403 ErrorState)

**Q21. 예상 엣지케이스**:
- 이미지 MIME 타입 불일치 → presign 전 클라이언트 검증 (ALLOWED_CONTENT_TYPES)
- 파일 크기 초과 → presign 전 클라이언트 검증 (10MiB)
- 비승인 판매자가 seller 라우트 접근 → 기존 `isSeller` 분기 처리 (변경 없음)
- 비관리자가 admin 라우트 접근 → middleware 차단 + ErrorState
- 상품에 이미 10장 이미지 → 추가 버튼 비활성화

**Q22. 데이터 백업/복구**: 해당 없음 (이미지 URL만 저장, R2 바이너리는 별도 관리).

## 보완 내용

사용자 최종 확인 완료 (2026-06-30). 4개 미결 사항 모두 추천안으로 확정:

| QA | 선택 | 확정 내용 |
|---|---|---|
| QA-1 | A | 백엔드 GET /auth/me에 isAdmin 추가. AuthProfileResponse DTO + AuthService ADMIN_USER_IDS 비교. 본 스펙에 백엔드 변경 포함. |
| QA-2 | B | 다중 이미지 최대 10장. 이미지 목록 표시 + 개별 삭제. POST/DELETE /products/:id/images 활용. |
| QA-3 | B | 로그인 + 판매자·관리자 화면 접근 3~4개 시나리오. 파일 업로드 E2E는 범위 외. |
| QA-4 | C | 선택적 소급 — 이번 스펙에서 변경하는 페이지만(상품 상세 이미지 섹션, 배너 생성 다이얼로그). 기존 미변경 페이지는 현행 유지. |
