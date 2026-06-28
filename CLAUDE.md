# DOA Market (doa-next)

## 개요

기존 AWS 기반 MSA 18개 서비스 오픈마켓을 Fly.io + 모듈러 모놀리스(NestJS)로 재구축하는 프로젝트.
AWS 의존 완전 제거, 월 고정비 1/10 절감, 단일 배포 단위로의 단순화가 목표이다.

## 개발 워크플로우

이 프로젝트는 SDD(Spec-Driven Development) 파이프라인을 사용한다.
파이프라인 진입점: ~/.claude/skills/pipeline/SKILL.md

## Constitution (프로젝트 불변 원칙)

프로젝트 불변 원칙은 `.claude/docs/constitution.md`에 정의한다.
모든 설계·구현·검증 작업 전에 먼저 읽어 원칙을 숙지한다.
constitution 조항이 전역 규칙과 충돌하는 경우, constitution이 우선한다.

> **작성 시 주의**: constitution에 기재된 수치·조건은 이후 모든 spec의 Constitution Gates에서
> **무조건 우선 기준**으로 적용된다. spec.md의 NFR이 constitution보다 완화된 값을 제시해도
> constitution 기준이 강제된다. 따라서 조항에 기재하는 수치는 프로젝트 전체에 항상 적용
> 가능한 값이어야 하며, 특정 기능에만 해당하는 기준은 기재하지 않는다.

## Context (프로젝트 구조·흐름·도메인 지식)

프로젝트 구조·이벤트 흐름·도메인 용어·알려진 제약은 `.claude/docs/context.md`에 정의한다.
새 spec 설계 전 반드시 읽어 전체 시스템 맥락을 숙지한다.
존재하지 않으면 건너뛴다. spec 구현·검증 완료 후 변경된 내용을 반영하여 갱신한다.

## Infra (인프라 토폴로지·배포 방식·운영 제약)

인프라 토폴로지·환경변수·배포 방식·운영 제약은 `.claude/docs/infra.md`에 정의한다.
배포·환경 구성에 영향을 주는 spec 설계 전 반드시 읽어 운영 제약을 파악한다.
존재하지 않거나 배포·환경과 무관한 순수 로직 변경 spec이면 건너뛴다.
인프라 변경 후 변경된 내용을 반영하여 갱신한다.

## 산출물 경로

docs/specs/v{version}/{NNN}-{spec-name}/

## AI 작업 폴더

`_ai-workspace/` 폴더는 AI 전용 작업 폴더로, 커밋 대상에서 제외한다.
