---
작성: Docs Agent (retroactive)
버전: v1.0
최종 수정: 2026-06-30 02:51
상태: 확정 (retroactive)
---

# Selection Phases: 009-flutter-customer-app

> 선택 Phase Agent 활성화 여부를 결정한다. 활성화(Y) 시 해당 Agent가 실행된다.
> 본 문서는 구현 완료 코드를 기준으로 retroactive 작성되었다.

## 목차

- [선택 단계 활성화 결정표](#선택-단계-활성화-결정표)
- [결정 근거](#결정-근거)

---

## 선택 단계 활성화 결정표

| 선택 Phase | 활성화 | 이유 |
|---|---|---|
| Database Design Agent | N | DB 스키마 변경 없음. Flutter 앱은 기존 백엔드 API를 소비만 한다. |
| Deploy Agent | N | 배포 구성 변경 없음. Flutter 앱은 독립 빌드 단위로 서버 배포와 무관. |
| Security Agent | N | 신규 외부 연동 없음. JWT는 FlutterSecureStorage에 안전하게 저장. Bearer 주입·refresh는 인터셉터로 처리. |
| Performance Agent | N | 추가 서버 쿼리 없음. Flutter 앱은 기존 백엔드 엔드포인트를 소비하며 서버 성능 변화 없음. |

---

## 결정 근거

- **Database Design Agent(N)**: Flutter 앱은 프론트엔드 클라이언트로 백엔드 API를 HTTP로 소비한다.
  데이터베이스 스키마·마이그레이션 변경이 없다.

- **Deploy Agent(N)**: Flutter 앱은 독립 빌드 단위(APK/IPA)로 서버 배포 파이프라인과 무관하다.
  백엔드 서버의 환경변수·인프라 구성 변경이 없다.

- **Security Agent(N)**: JWT는 `flutter_secure_storage`(OS Keychain/Keystore)에 안전하게 영속된다.
  Bearer 토큰 주입·401 자동 refresh는 Dio 인터셉터로 집중 처리된다.
  신규 외부 시스템 연동 없음. 기존 백엔드 인증·인가 정책 변경 없음.

- **Performance Agent(N)**: Flutter 앱이 추가하는 서버 부하가 없다(기존 백엔드 엔드포인트 소비).
  찜·최근 본 상품의 N+1 패턴은 클라이언트 측 구조 부채로, 서버 성능 검증 범위 외다(GAP-009-02).
