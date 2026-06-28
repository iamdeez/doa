---
작성: Spec Agent
버전: v1.0
최종 수정: 2026-06-28
상태: 확정
---

# Assumptions: 001-skeleton-bootstrap

| ID | 가정 내용 | 확인 필요 여부 | 확인 방법 |
|---|---|---|---|
| ASM-001 | Stage 1 시점에 Fly.io 계정, flyctl CLI, Fly secrets(DATABASE_URL 등)가 미준비 상태다. 따라서 GitHub Actions CI 파이프라인은 docker build까지만 포함하며 flyctl deploy 단계를 포함하지 않는다. | Y — Fly.io 준비 완료 시 CI에 배포 단계 추가 필요 | 개발팀이 Fly.io 계정·시크릿 준비 완료 여부를 확인 후 CI workflow 갱신 |
| ASM-002 | 로컬 개발 환경에 pnpm, Node.js(LTS), Docker가 이미 설치되어 있다고 가정한다. | N — 일반적 개발 환경 전제 | 개발팀 로컬 환경 세팅 가이드 (CONTRIBUTING.md 또는 README) |
| ASM-003 | GitHub Actions ubuntu-latest 러너에서 Docker buildx(멀티스테이지 빌드 지원)가 기본 제공된다고 가정한다. | N — ubuntu-latest 기본 제공 확인됨 | — |
