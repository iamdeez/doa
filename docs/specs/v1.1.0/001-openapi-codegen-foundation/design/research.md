---
작성: Design Agent
버전: v1.0
최종 수정: 2026-06-29 22:32
상태: 확정 (retroactive)
---

# Research: 001-openapi-codegen-foundation

## 목차

- [분석 우선순위 게이트 결과](#분석-우선순위-게이트-결과)
- [기존 코드베이스 분석](#기존-코드베이스-분석)
  - [모노레포 구조·공유 패키지 현황](#모노레포-구조공유-패키지-현황)
  - [수기 shared-types 한계](#수기-shared-types-한계)
- [수기 타입 vs 코드젠 비교](#수기-타입-vs-코드젠-비교)
- [CLI 플러그인 vs 수기 @ApiProperty 비교](#cli-플러그인-vs-수기-apiproperty-비교)
- [ts-node 직접 실행 미적용 한계](#ts-node-직접-실행-미적용-한계)
- [openapi-typescript 선택 근거](#openapi-typescript-선택-근거)
- [생성물 검증 (직접 카운트)](#생성물-검증-직접-카운트)
- [엣지 케이스 및 한계](#엣지-케이스-및-한계)

---

## 분석 우선순위 게이트 결과

- **변경 대상(plan §핵심 설계)**: `apps/backend`(nest-cli.json 플러그인·src/openapi.ts 생성기·package.json
  스크립트/의존·openapi.json 생성물), `packages/shared-types`(package.json devDep/스크립트·index.ts
  재노출·openapi.gen.ts 생성물). `apps/console`·`packages/api-client`·DTO 본문 **변경 없음**.
- §A·B·C 분석은 openapi.ts·nest-cli.json·shared-types index.ts 로 한정.
- §D(다단계 병렬 파이프라인): 미해당.
- §E(동일 가드 결정 통합): 미해당(인가 변경 없음).
- 외부 라이브러리 검증(§4): **신규 라이브러리 2건** — `@nestjs/swagger ^11.4.4`(NestJS 11 호환 검증
  필요), `openapi-typescript ^7.13.0`(코드젠 도구). 아래 비교 절에서 선택 근거 분석.
- §F(production 시그니처 변경): **미해당** — 기존 모듈·DTO·서비스 시그니처 변경 0. 신규 파일(openapi.ts)
  추가 + 빌드 설정(nest-cli.json)·패키지 스크립트 변경. 기존 console 화면 코드 불변.

---

## 기존 코드베이스 분석

> context.md 의 모노레포 구조를 기준선. 본 절은 변경 대상 한정 정밀 분석.

### 모노레포 구조·공유 패키지 현황

- **OOP 상속/추상 클래스 없음**: 변경 대상은 빌드 스크립트(`openapi.ts` — top-level async 함수)와 패키지
  설정·타입 재노출이다. NestJS 모듈 클래스 계층은 변경하지 않는다(`AppModule` 을 생성기가 부팅만 함).
- **공유 패키지 3종**(FRONTEND-PLAN.md §2-2): `@doa/shared-types`(수기 타입), `@doa/api-client`
  (HttpClient + 도메인 메서드), `@doa/ui`(기본 컴포넌트). 001 은 `@doa/shared-types` 만 변경(api-client·
  ui 불변).
- **백엔드 라우트 표면**: 18개 도메인 컨트롤러. OpenAPI/Swagger 미설치 상태 → 001 에서 도입.

### 수기 shared-types 한계

- `packages/shared-types/src/index.ts` 는 `auth`·`user`·`product`·`inventory`·`seller`(001/002 도메인)
  타입만 수기 작성(`LoginRequest`·`AuthTokens`·`UserProfile`·`Address`·`SellerProfile`·`Product`·
  `Category`·`ProductVariant`·`StockInRequest` 등). commerce 이후 11개 도메인(주문·결제·쿠폰·배송·정산·
  리뷰·검색·알림·파일·배너·통계·관리자) 타입 누락.
- 백엔드 DTO 변경 시마다 사람이 수동으로 대응 타입을 갱신해야 하며, 18개 도메인 규모에서 drift·누락·
  유지보수 부담이 구조적으로 누적된다(배경 — 코드젠 도입 동기).

---

## 수기 타입 vs 코드젠 비교

| 항목 | 수기 shared-types(기존) | OpenAPI 코드젠(001 채택) |
|---|---|---|
| SSOT | 프론트 수기 타입(백엔드와 분리) | **백엔드 코드(DTO + class-validator + JSDoc)** |
| 동기화 | 사람이 18도메인 수동 갱신 | `openapi:gen` → `gen` 2단계 결정적 재생성 |
| drift 위험 | 높음(누락·불일치 누적) | 낮음(생성물이 백엔드 계약 반영) |
| 검증 제약 표현 | 사람이 주석으로 기재 | `minLength`·`minimum`·`format` 자동 |
| 커버리지 | 001/002 도메인만(11도메인 누락) | 70 paths/32 schemas 전체 |

> 채택: 코드젠(ADR-001). 18도메인 수기 동기화 부담 제거 + 계약 SSOT 를 백엔드로 단일화.

---

## CLI 플러그인 vs 수기 @ApiProperty 비교

| 항목 | 수기 `@ApiProperty`(대안) | CLI 플러그인 introspect(001 채택) |
|---|---|---|
| DTO 변경량 | 18도메인 DTO 전부에 데코레이터 수기 추가(큰 소스 변경) | **0**(class-validator + JSDoc 재사용) |
| 검증 제약 동기화 | `@MinLength` 와 `@ApiProperty({minLength})` 이중 기재(drift) | class-validator 단일 소스에서 자동 도출 |
| 설명(description) | `@ApiProperty({ description })` 별도 기재 | `introspectComments:true` 로 JSDoc 자동 |
| enum | `@ApiProperty({ enum })` 수기 | `@IsEnum`/타입에서 자동 |

> 채택: CLI 플러그인(ADR-002, NFR-001 수기 데코레이터 0). `nest-cli.json` 에 플러그인 등록만으로
> `nest build` 컴파일 시 `*.dto.ts`/`*.entity.ts`(`dtoFileNameSuffix`)의 메타데이터가 자동 주입된다.
> 실측: `RegisterDto`(email format:email·password minLength:8·required), `CreateCouponDto`(type enum
> FIXED/PERCENTAGE·totalQuantity minimum:1·discountValue 한글 JSDoc 설명·required) 가 수기 데코레이터
> 0 으로 채워짐(생성물 직접 확인).

---

## ts-node 직접 실행 미적용 한계

- **현상**: `@nestjs/swagger` CLI 플러그인은 **TypeScript 컴파일(`nest build`) 단계**에서 AST 를 변환하여
  `@ApiProperty` 메타데이터를 주입한다. 따라서 컴파일을 거치지 않는 `ts-node src/openapi.ts` 직접 실행은
  플러그인이 적용되지 않아 **빈 스키마**(속성 없는 component)를 산출한다.
- **귀결**: 생성 스크립트는 반드시 `nest build`(플러그인 적용 컴파일) → `node dist/openapi.js`(빌드
  산출물 실행) 순이어야 한다. `openapi:gen = "nest build && node dist/openapi.js"`(ADR-003·FR-003·SC-004)가
  이 순서를 강제한다. 향후 생성 절차 변경 시 이 전제를 반드시 유지해야 한다(빌드 경유 필수).

---

## openapi-typescript 선택 근거

- **결정적 TS interface 생성**: `openapi-typescript` 는 OpenAPI JSON 을 입력으로 `paths`/`components`/
  `operations` 타입을 담은 단일 `.ts` 파일을 생성한다(런타임 코드 0 — 순수 타입). 프론트는 생성된
  `components['schemas'][...]` 를 참조하여 컴파일 타임 안전을 얻는다.
- **버전**: `^7.13.0`(shared-types devDependency). 생성물 `openapi.gen.ts` 는 3220줄(paths/components/
  operations interface).
- **Flutter 와의 역할 분리**: console 은 `openapi-typescript`(TS), Flutter 는 `openapi-generator(dart)`
  (Phase 5)로 동일 `openapi.json` 을 양 플랫폼이 각자 코드젠한다(FRONTEND-PLAN.md §1).

---

## 생성물 검증 (직접 카운트)

> 생성물 수치는 추측하지 않고 직접 카운트하여 확정했다(자가 보고 신뢰하지 않음).

| 산출물 | 측정 | 값 | 측정 방법 |
|---|---|---|---|
| `apps/backend/openapi.json` | OpenAPI 버전 | 3.0.0 | `node -e "require(...).openapi"` |
| | paths | **70** | `Object.keys(d.paths).length` |
| | component schemas | **32** | `Object.keys(d.components.schemas).length` |
| | info | title `DOA Market API` / version `1.0.0` | `d.info` |
| | securitySchemes | `access-token`(http bearer JWT) | `Object.keys(d.components.securitySchemes)` |
| | 파일 크기 | 72K(73,497 bytes) / 3127줄 | `ls -lah` / `wc -l` |
| `packages/shared-types/src/openapi.gen.ts` | 줄수 | **3220** | `wc -l` / `awk END{NR}`(동일) |
| | 파일 크기 | 84K | `ls -lah` |

- component schemas 32종 구성: 입력(request) DTO `*Dto` 31종(`RegisterDto`·`LoginDto`·`CreateProductDto`·
  `CreateCouponDto`·`CreateOrderDto`·`CreatePaymentDto`·`PresignDto`·`ConfirmFileDto`·`CreateBannerDto`
  등) + `OrderItemInput` 1종. **응답(response) 엔티티 스키마는 component 미등록**(아래 한계 참조).

---

## 엣지 케이스 및 한계

- **빌드 경유 필수**: ts-node 직접 실행 시 빈 스키마(위 §ts-node 한계). `openapi:gen` 스크립트가 빌드
  경유를 고정.
- **response 스키마 미주석**: component schemas 32종은 전부 입력 DTO 다. 87 operations 중 typed 2xx
  response content 는 36건이며, 응답 본문은 대부분 타입 미주석이다(컨트롤러가 엔티티를 반환하나
  `@ApiResponse({ type })`·응답 DTO 미부여). 프론트는 응답 타입을 부분적으로만 코드젠에서 얻으며, 응답
  스키마 보강은 후속 권고다(GAP-001-01, coverage-gap.md).
- **생성물 drift**: 백엔드 DTO 변경 후 `openapi:gen` → `gen` 재실행을 누락하면 생성물이 최신 DTO 와
  불일치한다. CI 자동 재생성·diff 검증이 없어 사람이 절차를 지켜야 한다(GAP-001-01).
- **console 회귀 0 전제(수기 타입 한시 유지)**: 생성 타입을 즉시 적용하지 않고 수기 타입을 유지하므로,
  본 차수에서 console 화면 코드는 불변이며 타입체크 회귀가 0 이다(NFR-003·SC-005). api-client 전환 시점에
  생성 타입으로의 실제 마이그레이션이 시작된다(후속 차수).

가정-실제 불일치 현재 미발견(생성물 수치·스키마 속성을 직접 카운트·조회로 확인).
