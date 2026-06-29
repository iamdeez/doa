---
작성: Security Agent
버전: v1.0
최종 수정: 2026-06-29 17:50
상태: 확정 (retroactive)
---

# 보안 감사 결과 — 006-search-notification-file

## 목차

- [검토 범위](#검토-범위)
- [요약](#요약)
- [Constitution 보안 조항 이행 현황](#constitution-보안-조항-이행-현황)
- [취약점 목록](#취약점-목록)
- [NFR 보안 요구사항 이행 현황](#nfr-보안-요구사항-이행-현황)
- [OWASP Top 10 점검 결과](#owasp-top-10-점검-결과)
- [긍정 확인 사항](#긍정-확인-사항)
- [권고사항](#권고사항)

---

## 검토 범위

### 검토 대상 파일 (DIFF-006-search-notification-file.md 기반)

| 파일 | 검토 이유 |
|---|---|
| `search/search.controller.ts` | 공개 엔드포인트(인증 불필요) 노출 범위 |
| `search/search.service.ts` | ProductService DI 경계(P-001), 입력 정규화 |
| `search/dto/search-products.dto.ts` | 검색 입력 검증(정렬 enum·가격 문자열) |
| `notification/notification.controller.ts` | 인증(JwtAuthGuard)·라우팅 |
| `notification/notification.service.ts` | 알림 소유권 검증(IDOR), markRead/markAllRead |
| `notification/notification.repository.ts` | cross-schema 격리(P-001) |
| `file/file.controller.ts` | 인증(JwtAuthGuard), presign/조회/삭제 |
| `file/file.service.ts` | 파일 소유권(delete), 메타 조회(getById), presign 키·입력 |
| `file/file.repository.ts` | cross-schema 격리(P-001) |
| `file/file-storage.port.ts`, `file/stub-file-storage.ts` | 외부 의존 추상화(P-002), URL 생성 |
| `file/dto/presign.dto.ts` | presign 입력 검증(purpose·contentType) |
| `product/product.service.ts`, `product/product.repository.ts` | 검색 질의(상태 필터·Decimal 가격) |
| `prisma/schema.prisma` | 데이터 타입·제약(key @unique·금전 필드 부재) |
| `test/static/cross-schema.spec.ts` | SC-053 정적 검증 |

### 제외 파일 및 사유

- `notification/dto/list-notifications.dto.ts` — page·size 정수 검증만, 민감 입력 없음
- `*.events.ts`(search·notification·file), 모듈·spec 파일 — 보안 관련 로직 없음(빈 스캐폴드/와이어링)

---

## 요약

| 항목 | 내용 |
|---|---|
| 검토 대상 파일 수 | 14개 |
| Critical 건수 | 0 |
| High 건수 | 0 |
| Medium 건수 | 0 |
| Low 건수 | 2 (SEC-FIND-006-01, SEC-FIND-006-02) |
| 전체 취약점 건수 | 2 |
| 판정 | **COMPLETE** — Critical/High 0건, Low 2건 권고사항으로 기록 |

---

## Constitution 보안 조항 이행 현황

| 조항 | 이행 여부 | 비고 |
|---|---|---|
| P-001 (모듈 경계 원칙) | 이행 | search 자체 테이블 없음(ProductService DI read-only). NotificationRepository → users.notifications 만, FileRepository → files.files 만. SC-053 정적 검증 PASS |
| P-002 (외부 의존 추상화) | 이행 | `@aws-sdk/*` 등 신규 의존 0. R2 연동 `FileStoragePort` + `StubFileStorage`(무네트워크 결정적 URL). `FILE_STORAGE` 토큰 DI |
| P-005 (결제·정산 정합성) | 해당 없음 | 006 신규 테이블에 금전 필드 없음. 검색 가격 필터는 `products.price` read-only 범위 비교(금전 상태 변경 부재) |

---

## 취약점 목록

### SEC-FIND-006-01 — Low

| 항목 | 내용 |
|---|---|
| **SEC-ID** | SEC-FIND-006-01 |
| **심각도** | Low |
| **OWASP** | A01 (Broken Access Control — 자원 메타 스코핑 부재) |
| **위치** | `apps/backend/src/modules/file/file.service.ts` `getById()` / `file/file.controller.ts` `GET /files/:id` |
| **설명** | `GET /files/:id` 가 소유권/인가 검증 없이 임의 인증 사용자에게 파일 메타(`key`·`url`·`ownerId`·`contentType`)를 노출한다. `JwtAuthGuard` 만 적용되어 인증된 사용자라면 타인 소유 파일의 메타를 조회할 수 있다. |
| **공격 경로** | 인증된 사용자 A 가 임의 파일 id 로 `GET /files/:id` 호출 → 타인(B) 소유 파일 메타 획득(key·url·ownerId 등). |
| **공격자 요건** | 임의 인증 사용자(JWT 보유). 파일 id 추정·열거 필요. |
| **실질 위험** | 낮음 — 현재 모든 파일이 public URL 모델(`publicUrl` 반환)이라 메타 노출이 모델과 정합한다. 다만 비공개 purpose(예: 민감 문서) 도입 시 메타 스코핑 부재가 정보 노출로 이어질 수 있다. |
| **수정 방향** | 비공개 purpose 도입 시 `getById` 에 `file.ownerId === userId` 검증 추가 또는 공개/비공개 구분(공개 purpose 만 무인가 메타 허용). |
| **상태** | **RESOLVED (011-file-security, 커밋 88de003)** — `getById(userId, id)` 가 `file.ownerId !== userId` → 403 ForbiddenException, 미존재 → 404 로 메타 IDOR 차단(공개/비공개 분기 대신 메타 엔드포인트 일괄 소유자 전용). 해결 검증은 `docs/specs/v1.0.0/011-file-security/security/security-report.md` 참조. |

### SEC-FIND-006-02 — Low

| 항목 | 내용 |
|---|---|
| **SEC-ID** | SEC-FIND-006-02 |
| **심각도** | Low |
| **OWASP** | A04 (Insecure Design — 입력 제약 부재) |
| **위치** | `apps/backend/src/modules/file/file.service.ts` `presign()` / `file/dto/presign.dto.ts` |
| **설명** | presign 이 클라이언트 `contentType` 을 무검증 수용한다(허용 MIME allowlist 부재). 파일 크기 상한이 적용되지 않으며 `size=0` placeholder 로 레코드를 생성한다. `PresignDto` 는 `purpose`(@IsEnum)·`contentType`(@IsString) 형식만 검증한다. |
| **공격 경로** | 클라이언트가 임의 content-type(예: `text/html`·실행 가능 타입) 또는 과대 파일을 presign 요청 → 실제 R2 전환 시 비허용 콘텐츠 업로드·스토리지 남용 표면. |
| **공격자 요건** | 임의 인증 사용자. 현재 stub 모델(무네트워크, 실제 업로드 미발생)에서는 표면 제한적. |
| **실질 위험** | 낮음 — 현재 `StubFileStorage` 가 실제 업로드를 수행하지 않아 악용 표면이 제한적이다. 실제 R2 presign 전환 시 content-type 바인딩·크기 제한이 필요하다. |
| **수정 방향** | 실제 R2 전환 시 (1) contentType allowlist 검증, (2) presigned URL 에 content-type·크기 제한 바인딩, (3) 비허용 입력 거부. |
| **상태** | **RESOLVED (011-file-security, 커밋 88de003)** — `presign` 이 `ALLOWED_CONTENT_TYPES`(image/jpeg·png·webp·gif) allowlist 외 contentType 을 400 BadRequest 로 거부(create 이전·repo 미호출), 크기 상한은 confirm 단계 `MAX_FILE_SIZE_BYTES`(10MiB)로 검증. 잔여: presign 시점 content-type 바인딩·실제 업로드 크기 교차검증은 R2 실연동 후속(011 gaps.md GAP-011-01, Low 권고). 해결 검증은 `docs/specs/v1.0.0/011-file-security/security/security-report.md` 참조. |

---

## NFR 보안 요구사항 이행 현황

| ID | 요구사항 | 이행 여부 | 비고 |
|---|---|---|---|
| NFR-001 | Repository cross-schema 접근 금지(P-001) | 이행 | search 자체 테이블 없음(ProductService DI). NotificationRepository·FileRepository 자기 소유 테이블 전용. SC-053 정적 검증 PASS |
| NFR-002 | 외부 의존 추상화·신규 의존 금지 | 이행 | R2 연동 `FileStoragePort` stub(무네트워크). 신규 npm 0. AWS SDK 0 |
| NFR-003 | 인증(JwtAuthGuard) | 이행 | notification 3 + file 3 엔드포인트 JwtAuthGuard. search 는 공개(설계상 의도). 비인증 401(SC-011) |
| NFR-004 | 자원 소유권(IDOR 차단) | 부분 이행 | notification.markRead(`userId` 검증, 403), file.delete(`ownerId` 검증, 403)는 이행. **단 file.getById 소유권 미검증(SEC-FIND-006-01)** |
| NFR-005 | 금전 필드 부재(P-005 해당 없음) | 이행 | notifications·file_assets 금전 필드 0. 검색 가격 필터는 read-only |

---

## OWASP Top 10 점검 결과

| OWASP | 항목 | 점검 결과 | 근거 |
|---|---|---|---|
| A01 | 접근 제어 취약점 | Low 1건 (SEC-FIND-006-01) | notification.markRead/markAllRead·file.delete 는 소유권 검증(403). **file.getById 메타 스코핑 부재(Low)**. search 공개는 read-only ACTIVE·OUT_OF_STOCK 한정 |
| A02 | 암호화 실패 | 해당 없음 | 암호화 신규 로직 없음. JWT 는 기존 공유 모듈 |
| A03 | 인젝션 | 양호 | Prisma 파라미터화 쿼리만. raw SQL 미사용. 검색 q 는 `contains`(파라미터 바인딩) |
| A04 | 안전하지 않은 설계 | Low 1건 (SEC-FIND-006-02) | presign contentType allowlist·크기 상한 부재(Low, stub 모델). 그 외 흐름 설계 양호 |
| A05 | 보안 설정 오류 | 양호 | cross-schema 격리(SC-053). 전역 ValidationPipe(whitelist·forbidNonWhitelisted) |
| A06 | 취약한 컴포넌트 | 양호 | 기존 검증 라이브러리(class-validator·Prisma·node:crypto) 재사용. 신규 패키지 0 |
| A07 | 인증·세션 관리 | 양호 | notification·file JwtAuthGuard. search 공개는 의도된 설계 |
| A08 | 소프트웨어 무결성 | 양호 | presign 키 `randomUUID()` + `key @unique`. 이벤트/외부 코드 주입 없음 |
| A09 | 로깅·모니터링 | 양호 | StubFileStorage presign 로깅(Logger). 민감정보(토큰) 미로깅 |
| A10 | SSRF | 해당 없음 | 외부 URL 조회 로직 없음. stub 은 결정적 문자열만 반환(네트워크 호출 없음) |

---

## 긍정 확인 사항

본 감사에서 확인된 안전한 설계·구현:

| 항목 | 확인 내용 |
|---|---|
| **알림·파일 자원 소유권 검증** | `notification.markRead` 가 `notification.userId !== userId` 시 403, `file.delete` 가 `file.ownerId !== userId` 시 403. 403/404 케이스에서 mutation repository 미호출(SC-006·SC-010). 타인 알림 읽음·타인 파일 삭제 차단 |
| **R2 stub 무네트워크 추상화** | 객체 스토리지 연동을 `FileStoragePort` 인터페이스 + `StubFileStorage` 로 추상화. stub 은 외부 네트워크 호출 없이 결정적 URL(`https://r2.stub.local/{key}`)만 반환 → 테스트 결정성·외부 의존 0(P-002) |
| **AdminGuard 해당 없음** | 006 엔드포인트에는 관리자 전용 동작이 없다. 모든 인증 엔드포인트는 본인 자원 범위(notification·file)이며 권한 상승 표면 없음 |
| **DTO class-validator 검증** | `SearchProductsDto`(@IsIn(SEARCH_SORTS)·@IsNumberString)·`PresignDto`(@IsEnum(FilePurpose)·@IsString)·`ListNotificationsDto`(@IsInt·@Min(1)). 전역 ValidationPipe(whitelist·forbidNonWhitelisted·transform) → 잘못된 sort 400(SC-011) |
| **모듈 경계(P-001) 격리** | search 가 products 를 직접 쿼리하지 않고 `ProductService` DI 경유. notification/file repository 가 자기 소유 테이블만 접근. cross-schema 참조 전부 plain String(SC-053) |
| **검색 노출 범위 제한** | `ProductRepository.searchProducts` 가 `ACTIVE`·`OUT_OF_STOCK` 상품만 노출(DRAFT·SUSPENDED 미노출). 공개 엔드포인트지만 read-only·상태 제한 |

---

## 권고사항

### 권고-001 (Low, SEC-FIND-006-01 관련)

비공개 파일 메타 스코핑 — 비공개 purpose 도입 시 처리 권장:

```typescript
// file.service.ts getById — 비공개 purpose 도입 시 추가 권고
// 공개 purpose(PRODUCT_IMAGE 등)는 무인가 허용, 비공개는 ownerId 검증
async getById(userId: string, id: string): Promise<FileAsset> {
  const file = await this.fileRepository.findById(id);
  if (!file) throw new NotFoundException('File not found');
  if (isPrivate(file.purpose) && file.ownerId !== userId) throw new ForbiddenException();
  return file;
}
```

### 권고-002 (Low, SEC-FIND-006-02 관련)

presign 입력 제약 — 실제 R2 presign 전환 시 처리 권장:

```typescript
// presign 추가 권고
// 1) contentType allowlist 검증 (예: image/png|jpeg|webp)
// 2) presigned URL 에 content-type·max content-length 바인딩
// 3) 비허용 입력 거부 단위 테스트
```

### 일반 권고 (Informational)

- **알림 이벤트 연동(GAP-006-01)**: `NotificationService.create()` 가 진입점만 제공하고 도메인 이벤트
  핸들러 연동이 미구현이다. 보안 영향은 없으나 기능 완결성 차원에서 후속 연동 권장.
- **파일 confirm·고아 PENDING 정리(GAP-006-02)**: PENDING→UPLOADED 전이 부재로 고아 레코드 누적
  가능. 보안 영향은 제한적이나 운영상 정리 정책(TTL 배치) 검토 권장. → **RESOLVED (011-file-security,
  커밋 88de003)** — `POST /files/:id/confirm`(소유자 전용, 멱등)이 PENDING→UPLOADED 전이 + size 기록으로
  정상 전이 경로를 확보. 잔여 고아 PENDING(미confirm) 의 TTL 배치 정리는 운영 정책 후속.
