---
작성: Database Design Agent
버전: v1.0
최종 수정: 2026-06-29 17:50
상태: 확정 (retroactive)
---

# 006 마이그레이션 포인터

## 목차

- [실제 마이그레이션 위치](#실제-마이그레이션-위치)
- [포함 내용 요약](#포함-내용-요약)
- [드리프트 없음 확인](#드리프트-없음-확인)

---

## 실제 마이그레이션 위치

006 의 실제 적용 마이그레이션 SQL 은 Prisma 마이그레이션 디렉토리에 위치하며 git 이 형상관리
SoT 다. 본 문서는 전체 SQL 을 중복 박제하지 않고 경로·요약만 가리킨다.

```
apps/backend/prisma/migrations/20260629081946_006_search_notification_file/migration.sql
```

전체 내용 확인:

```bash
cat apps/backend/prisma/migrations/20260629081946_006_search_notification_file/migration.sql
```

테이블 정의·컬럼·인덱스·제약의 사람이 읽을 설명은 [../data-model.md](../data-model.md) 가 담당한다.

---

## 포함 내용 요약

해당 마이그레이션 파일이 생성하는 객체:

| 종류 | 객체 | 스키마 |
|---|---|---|
| Enum | `NotificationType` (ORDER_PLACED, ORDER_SHIPPED, SETTLEMENT_CREATED, REVIEW_RECEIVED) | users |
| Enum | `FilePurpose` (PRODUCT_IMAGE, REVIEW_IMAGE, PROFILE) | files |
| Enum | `FileStatus` (PENDING, UPLOADED) | files |
| Table | `notifications` (userId, type, title, body, isRead, createdAt) | users |
| Table | `files` (ownerId, purpose, key, url, contentType, size, status, createdAt) | files |
| Index | `notifications_userId_isRead_createdAt_idx` (createdAt DESC) | users |
| Index (UNIQUE) | `files_key_key` (key) | files |
| Index | `files_ownerId_createdAt_idx` (createdAt DESC) | files |

> 본 마이그레이션에는 FK 가 없다 — 두 테이블 모두 단일 테이블이며 cross-schema 참조는 plain String(FK 미선언, P-001).

---

## 드리프트 없음 확인

005 마이그레이션(`20260629080659_005_shipping_settlement`)에는 004 테이블 생성이 함께 캡처된
드리프트(GAP-005-03)가 있었으나, 006 마이그레이션(`20260629081946_006_search_notification_file`)은
**검색·알림·파일 spec 의 객체만** 포함하는 단일 산출물이다. 005 완료 시점에 schema.prisma 와 DB 가
동기화된 상태에서 006 의 `prisma migrate dev` 가 실행되어, 타 spec 테이블 동반 캡처 없이 깔끔하게
생성되었다. 별도 히스토리 정리 필요 없음.
