---
작성: Docs Agent
버전: v1.0
최종 수정: 2026-06-30 03:37
상태: 확정 (retroactive)
---

# Selection Phases: 010-backend-response-schemas

## 목차

- [선택 단계 활성화 결정](#선택-단계-활성화-결정)

---

## 선택 단계 활성화 결정

| 선택 단계 | 활성화 | 판단 근거 |
|---|---|---|
| Database Design Agent | N | DB 스키마 변경 없음. DTO는 런타임 무관 문서 전용. |
| Deploy Agent | N | 배포 방식·환경변수·인프라 변경 없음. |
| Security Agent | N | 새 인증·권한 로직 없음. 어노테이션 추가 전용. |
| Performance Agent | N | 런타임 코드 경로 변경 없음. 처리 성능 영향 없음. |
