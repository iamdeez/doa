---
작성: Planning Agent
버전: v1.0
최종 수정: 2026-06-29 17:50
상태: 확정 (retroactive)
---

# selection-phases.md

## 목차

- [선택 단계 활성화 결정](#선택-단계-활성화-결정)
- [신규 PyPI/npm 의존성 자가 점검](#신규-pypinpm-의존성-자가-점검)
- [활성화된 단계 실행 순서](#활성화된-단계-실행-순서)
- [결정 일시 및 결정자](#결정-일시-및-결정자)

## 선택 단계 활성화 결정

> 활성화 기준: spec.md FR/NFR 에 **명시적 요구사항**이 존재할 때만 활성화(암묵적 연관 금지).

- **Database Design Agent**: **Y**
  - 근거: FR 에 신규 2테이블(`users.notifications`·`files.files`) + 3 enum(`NotificationType`·`FilePurpose`·`FileStatus`) + 신규 `files` 스키마 분리 + cross-schema plain String 경계(`notifications.userId`·`file_assets.ownerId`) + 알림 조회 인덱스(`(userId, isRead, createdAt desc)`) + 파일 조회 인덱스(`(ownerId, createdAt desc)`) + `file_assets.key @unique` 제약이 명시됨(spec.md FR-004·007·009, NFR-001). plan.md 데이터 모델 절이 DB Design 입력 contract. SC-053(cross-schema 정적) 검증 대상.

- **Deploy Agent**: **N**
  - 근거: FR/NFR 에 배포 환경 구성·컨테이너화·CI/CD 변경 명시 없음. 신규 npm 의존성 0건, Dockerfile/docker-compose 구조 변경 0건. `[env:e2e-docker]` 태그 SC 부재. R2 연동은 `FileStoragePort` stub 추상화로 무네트워크이며 본 spec 신규 배포 구성·시크릿(R2 자격증명 등) 도입 없음. 002~005 동일 로컬 docker-compose + Fly.io 운영.

- **Security Agent**: **Y**
  - 근거: FR/NFR 에 보안 요구 다수 명시 — (1) **인증·인가**: notification·file 6 엔드포인트 JwtAuthGuard(NFR-003), 알림 읽음·파일 삭제 자원 소유권 검증(NFR-004, IDOR). (2) **파일 업로드 표면**: presign 입력 검증·메타 노출 스코핑(파일 메타 조회 인가). (3) 외부 의존 추상화(R2 stub, P-002). 파일·인가 보안 표면 존재. `GET /files/:id` 메타 스코핑·presign 입력 무검증도 감사 대상.

- **Performance Agent**: **N**
  - 근거: NFR 에 성능 목표 수치(P95 응답속도·처리량) 명시 없음. 검색·알림·파일 조회는 인덱스 설계(DB Design 담당)로 충족하며 별도 성능 검증 수치 기준 부재. 암묵적 연관으로 활성화하지 않음(MUST NOT).

## 신규 PyPI/npm 의존성 자가 점검

```
자가 점검: 본 spec 에 신규 의존성 추가가 있는가? (package.json dependencies 변경)
  → 없음. 신규 npm 패키지 0건. 기존 Prisma·NestJS·class-validator·class-transformer·@prisma/client 만 사용.
  → R2 연동도 외부 SDK 없이 FileStoragePort + StubFileStorage(node:crypto randomUUID 만 사용) 로 처리.
  → 본 항목 무관. (Deploy Agent 비활성)
```

## 활성화된 단계 실행 순서

- Database Design Agent: 3단계 후 / 4단계 전 (tasks.md 분해 입력으로 data-model.md·마이그레이션 확정)
- Security Agent: 6단계 후 / 7단계 전

> 캐스케이딩 블로킹: Deploy 비활성 → Security 독립 실행. Security BLOCKED(Critical/High) 시 Performance 스킵 — 단 Performance 비활성(N)이므로 무관. 실제 감사 결과 Critical/High 0건(SEC-FIND-006-01·02 Low) → COMPLETE.

## 결정 일시 및 결정자

- 결정 일시: 2026-06-29 17:50
- 결정자: Planning Agent (2단계, retroactive)
