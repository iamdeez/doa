---
작성: Security Agent
버전: v1.0
최종 수정: 2026-06-29 18:15
상태: 확정 (retroactive)
---

# 보안 감사 결과 — 007-banner-stats-admin

## 목차

- [검토 범위](#검토-범위)
- [요약](#요약)
- [Constitution 보안 조항 이행 현황](#constitution-보안-조항-이행-현황)
- [관찰 목록](#관찰-목록)
- [NFR 보안 요구사항 이행 현황](#nfr-보안-요구사항-이행-현황)
- [OWASP Top 10 점검 결과](#owasp-top-10-점검-결과)
- [긍정 확인 사항](#긍정-확인-사항)
- [권고사항](#권고사항)

---

## 검토 범위

### 검토 대상 파일 (DIFF-007-banner-stats-admin.md 기반)

| 파일 | 검토 이유 |
|---|---|
| `banner/banner.controller.ts` | 관리자 CRUD 인가(JwtAuthGuard+AdminGuard)·공개 GET 노출 범위 |
| `banner/banner.service.ts` | 노출기간 필터(공개 노출 범위), 404 분기 |
| `banner/banner.repository.ts` | admin.banners 단독 접근(P-001), cross-schema 격리 |
| `banner/dto/{create,update}-banner.dto.ts` | 배너 입력 검증(class-validator) |
| `stats/stats.controller.ts` | 관리자 overview(AdminGuard)·판매자 stats(본인 격리) 인가 |
| `stats/stats.service.ts` | 판매자 본인 격리(getApprovedSeller), 매출 Decimal 집계 |
| `stats/stats.repository.ts` | 자체 테이블 없음(P-001) |
| `admin/admin.controller.ts` | 관리자 운영 인가(JwtAuthGuard+AdminGuard) |
| `admin/admin.service.ts` | 승인 재사용, 사용자 목록 클램프·민감 필드 제외 |
| `admin/admin.repository.ts` | 자체 테이블 없음(P-001) |
| `order/order.repository.ts`, `order/order.service.ts` | 매출 집계(Decimal), orders 스키마 격리 |
| `user/user.service.ts`, `user/user.repository.ts` | 사용자 목록 password 제외, users 스키마 격리 |
| `seller/seller.service.ts`, `seller/seller.repository.ts` | 승인 재사용·상태 조회, sellers 스키마 격리 |
| `prisma/schema.prisma` | 데이터 타입·제약(banner 금전 필드 부재) |
| `test/static/cross-schema.spec.ts`, `auth-required-guards.spec.ts` | SC-011·정적 인가 검증 |

### 제외 파일 및 사유

- `admin/admin.constants.ts` — 페이지 크기 상수만, 민감 입력 없음
- `*.events.ts`(banner·stats·admin), 모듈·spec 파일 — 보안 관련 로직 없음(빈 스캐폴드/와이어링)

---

## 요약

| 항목 | 내용 |
|---|---|
| 검토 대상 파일 수 | 18개 |
| Critical 건수 | 0 |
| High 건수 | 0 |
| Medium 건수 | 0 |
| Low 건수 | 1 (OBS-007-01 — 설계 관찰, 라우트 표면) |
| 전체 취약점 건수 | 0 (취약점), 1 (Low 설계 관찰) |
| 판정 | **COMPLETE** — Critical/High/Medium 0건, Low 1건(설계 관찰) 권고사항으로 기록 |

---

## Constitution 보안 조항 이행 현황

| 조항 | 이행 여부 | 비고 |
|---|---|---|
| P-001 (모듈 경계 원칙) | 이행 | banner → admin.banners 만. stats·admin 자체 테이블 없음(도메인 Service DI). additive 집계는 자기 스키마. SC-011 정적 검증 PASS |
| P-002 (외부 의존 추상화) | 이행 | 신규 npm 의존 0. AWS SDK·외부 서비스 0 |
| P-005 (결제·정산 정합성) | 이행 (stats 한정) | stats 매출 집계 `Prisma.Decimal`(sumCompletedTotalAmount·getSellerCompletedSummary·overview.totalSales). banner 는 금전 필드 없음 |

---

## 관찰 목록

### OBS-007-01 — Low (설계 관찰, 취약점 아님)

| 항목 | 내용 |
|---|---|
| **OBS-ID** | OBS-007-01 |
| **심각도** | Low (설계 관찰) |
| **OWASP** | A04 (Insecure Design — 라우트 표면 중복, 권한 상승 아님) |
| **위치** | `apps/backend/src/modules/seller/seller.controller.ts` `PATCH /sellers/:id/approve` / `apps/backend/src/modules/admin/admin.controller.ts` `POST /admin/sellers/:id/approve` |
| **설명** | 판매자 승인(`SellerService.approve`, PENDING→APPROVED)이 두 라우트로 노출된다 — seller 컨트롤러(`PATCH /sellers/:id/approve`)와 admin 컨트롤러(`POST /admin/sellers/:id/approve`). 동일 `SellerService.approve` 를 호출하므로 로직 중복은 아니나 라우트 표면이 둘이다. |
| **공격 경로** | 없음(권한 상승 표면 아님). 두 라우트 모두 `JwtAuthGuard`+`AdminGuard`(fail-closed)로 보호되어 동일 인가 수준이다. |
| **공격자 요건** | 해당 없음 — 관리자만 통과. |
| **실질 위험** | 낮음 — 권한 표면 동일(양쪽 AdminGuard). 운영 일관성(정식 라우트 모호) 차원의 관찰이며 보안 노출은 없다. |
| **수정 방향** | 운영 라우트를 admin(`POST /admin/sellers/:id/approve`)으로 일원화하고 seller 측 approve 라우트 폐기 여부를 후속 정책 spec 에서 결정. |
| **상태** | OPEN (gaps.md 교차 기재, 후속 정책 spec 위임) |

---

## NFR 보안 요구사항 이행 현황

| ID | 요구사항 | 이행 여부 | 비고 |
|---|---|---|---|
| NFR-001 | Repository cross-schema 접근 금지(P-001) | 이행 | banner → admin.banners 만. stats·admin 자체 테이블 없음(DI). additive 집계 자기 스키마. SC-011 PASS |
| NFR-002 | 외부 의존 추상화·신규 의존 금지 | 이행 | 신규 npm 0. AWS SDK 0 |
| NFR-003 | 인증·인가(JwtAuthGuard+AdminGuard) | 이행 | 관리자 9 엔드포인트 JwtAuthGuard+AdminGuard(fail-closed). 판매자 stats JwtAuthGuard. `GET /banners` 공개(설계 의도). 비인증 401·비관리자 403(SC-010) |
| NFR-004 | 자원 격리 | 이행 | 판매자 stats 본인 sellerId 격리(`getApprovedSeller`, 미승인 403). admin 사용자 목록 password 제외 안전 요약 |
| NFR-005 | 매출 Decimal(P-005)·banner 금전 필드 부재 | 이행 | stats 매출 Prisma.Decimal. banner 금전 필드 0 |

---

## OWASP Top 10 점검 결과

| OWASP | 항목 | 점검 결과 | 근거 |
|---|---|---|---|
| A01 | 접근 제어 취약점 | 양호 | 관리자 엔드포인트 전부 JwtAuthGuard+AdminGuard(fail-closed). 판매자 stats 본인 격리(403). `GET /banners` 공개는 read-only·활성·기간 내만 |
| A02 | 암호화 실패 | 해당 없음 | 암호화 신규 로직 없음. JWT 는 기존 공유 모듈 |
| A03 | 인젝션 | 양호 | Prisma 파라미터화 쿼리만. raw SQL 미사용. 배너 입력 class-validator 검증 |
| A04 | 안전하지 않은 설계 | Low 1건 (OBS-007-01) | 판매자 승인 병렬 라우트(권한 표면 동일, 일원화 권고). admin 사용자 목록 민감 필드 제외 양호 |
| A05 | 보안 설정 오류 | 양호 | cross-schema 격리(SC-011). 전역 ValidationPipe(whitelist·forbidNonWhitelisted). AdminGuard fail-closed(ADMIN_USER_IDS 미설정 시 전원 거부) |
| A06 | 취약한 컴포넌트 | 양호 | 기존 라이브러리(class-validator·Prisma) 재사용. 신규 패키지 0 |
| A07 | 인증·세션 관리 | 양호 | 관리자·판매자 JwtAuthGuard. AdminGuard 역할 검증. `GET /banners` 공개는 의도 |
| A08 | 소프트웨어 무결성 | 양호 | 외부 코드 주입 없음. 배너 입력 검증 |
| A09 | 로깅·모니터링 | 보완 권고 | 관리자 액션 audit log 부재(GAP-007-01) — 보안 사고 아니나 운영 추적 공백. 후속 권장 |
| A10 | SSRF | 해당 없음 | 외부 URL 조회 로직 없음. banner imageUrl/linkUrl 은 저장·반환만(서버 fetch 없음) |

---

## 긍정 확인 사항

본 감사에서 확인된 안전한 설계·구현:

| 항목 | 확인 내용 |
|---|---|
| **AdminGuard fail-closed 전 관리자 라우트** | banner CRUD(4) + stats overview + admin(3) = 관리자 8 엔드포인트가 `@UseGuards(JwtAuthGuard, AdminGuard)`. AdminGuard 는 `ADMIN_USER_IDS` 미설정/미포함 시 403(fail-closed). 비관리자 승격 표면 없음(SC-010 e2e 401/403 확인) |
| **판매자 stats 본인 격리** | `StatsService.getSellerStats` 가 `getApprovedSeller(userId)` 로 호출자 본인 sellerId 확정 후 집계 → 타 판매자 통계 접근 구조적 차단(미승인 403, SC-006) |
| **매출 집계 Decimal 정확성** | `sumCompletedTotalAmount`(aggregate _sum, 없으면 Decimal(0))·`getSellerCompletedSummary`(unitPrice.mul(quantity) Decimal 누적)·overview.totalSales/salesTotal 타입 Prisma.Decimal → 부동소수점 오차 없음(P-005) |
| **admin 사용자 목록 민감 필드 제외** | `UserService.listUsersForAdmin` 가 `AdminUserListItem`(id·email·name·phone·createdAt) 로 매핑 — password 등 민감 필드 미노출. limit 클램프(1..100) |
| **배너 입력 class-validator 검증** | `CreateBannerDto`(@IsString·@IsNotEmpty·@IsEnum(BannerPosition)·@IsInt·@IsBoolean·@IsDateString)·`UpdateBannerDto`(전 필드 optional). 전역 ValidationPipe(whitelist·forbidNonWhitelisted·transform) |
| **공개 배너 읽기 전용 노출** | `GET /banners` 는 무가드 공개이나 read-only 이며 `isActive=true` + 노출기간(`isWithinPeriod`) 필터로 노출 범위 제한. 비활성·기간 외 배너 미노출 |
| **모듈 경계(P-001) 격리** | banner 가 admin.banners 만 접근. stats·admin 이 도메인 Service DI 경유(직접 쿼리 0). cross-schema 직접 참조 0(SC-011) |

---

## 권고사항

### 권고-001 (Low, OBS-007-01 관련)

판매자 승인 라우트 일원화 — 후속 정책 spec 에서 처리 권장:

```
# 현재 (병렬 라우트, 둘 다 JwtAuthGuard+AdminGuard)
PATCH /sellers/:id/approve        (seller 컨트롤러 — 기존)
POST  /admin/sellers/:id/approve  (admin 컨트롤러 — 007 추가, SellerService.approve 재사용)

# 권고: 운영 라우트를 admin 으로 일원화, seller approve 라우트 폐기 여부 결정
```

### 일반 권고 (Informational)

- **관리자 액션 audit log(GAP-007-01)**: 승인·삭제 등 관리자 조치를 기록하는 append-only 감사 로그
  부재. 보안 사고는 아니나 다수 관리자 운영 시 책임 추적(거버넌스)을 위해 `admin_audit_logs` 후속 도입
  권장.
- **배너 노출기간 DB 푸시다운(GAP-007-02)**: 노출 필터가 애플리케이션 레벨(in-memory). 보안 영향 없으나
  배너 수 증가 시 DB where 절 푸시다운 검토.
- **banner imageUrl/linkUrl 검증**: 현재 `@IsString` 만 적용. 서버가 해당 URL 을 fetch 하지 않아 SSRF
  표면은 없으나, 프런트 렌더링 시 XSS(특히 linkUrl `javascript:` 스킴) 방지를 위해 클라이언트 측 sanitize
  또는 서버 URL 스킴 allowlist 검토 권장(현재 위험도 낮음 — 저장·반환만).
