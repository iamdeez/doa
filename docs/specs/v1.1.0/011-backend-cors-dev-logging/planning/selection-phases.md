---
작성: Docs Agent
버전: v1.0
최종 수정: 2026-06-30 13:56
상태: 확정 (retroactive)
---

# Selection Phases: 011-backend-cors-dev-logging

## 목차

- [선택 단계 활성화 결정](#선택-단계-활성화-결정)

---

## 선택 단계 활성화 결정

| 선택 단계 | 활성화 | 판단 근거 |
|---|---|---|
| Database Design Agent | N | DB 스키마 변경 없음. |
| Deploy Agent | N | 배포 스크립트·컨테이너 구성 변경 없음. 신규 환경변수(`CORS_ORIGIN`)는 선택적이며 기본값 fallback 존재. |
| Security Agent | N | CORS 기본값이 전체 허용이나 운영은 `CORS_ORIGIN` 화이트리스트로 제어 가능 — 신규 인증·권한 로직 없음. 보안 고려는 NFR-001·GAP-011-01 로 문서화. |
| Performance Agent | N | 런타임 핫패스 변경 없음. CORS 는 부팅 단계 1회 설정, pino-pretty 는 비프로덕션 전용. |

> **참고**: CORS 전체 허용 기본값은 보안 관점에서 운영 시 화이트리스트가 권장된다.
> 본 차수는 역문서화이며 Security Agent 를 활성화하지 않되, 운영 origin 화이트리스트 강제는
> GAP-011-01(및 spec 범위 외)로 후속 처리한다.
