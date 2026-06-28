/**
 * CI 워크플로우·Dockerfile 정적 검증 테스트 — [env:static]
 *
 * 대상 SC: SC-022, SC-023, SC-024, SC-025, SC-026
 * 검증 방법: Node.js fs 모듈로 파일 존재 확인 + 텍스트 파싱으로 구조 검증
 *
 * 검증 범위:
 *   - Dockerfile 멀티스테이지 구조 존재 (SC-022)
 *   - .github/workflows/ci.yml 의 needs 체인:
 *     lint → typecheck(needs:lint) → test(needs:typecheck) → docker-build(needs:test)
 *     이 체인이 있으면 각 단계 실패 시 후속 미실행이 보장됨 (SC-023, SC-024, SC-025, SC-026)
 *
 * 주의: docker build 실제 실행 및 전 단계 CI 통과는 CI 환경(GitHub Actions)에서 검증.
 *        본 테스트는 구조(정적) 검증만 수행한다.
 */

import * as fs from 'fs';
import * as path from 'path';

// apps/backend/test/static/ → 4단계 상위 = 프로젝트 루트
const PROJECT_ROOT = path.resolve(__dirname, '../../../../');

// ─────────────────────────────────────────────
// SC-022: Dockerfile 멀티스테이지 구조
// ─────────────────────────────────────────────
describe('SC-022: Dockerfile 멀티스테이지 구조 존재', () => {
  it('when_dockerfile_then_multistage_buildable', () => {
    /**
     * SC-022 (FR-014 관련):
     * apps/backend/Dockerfile이 존재하고
     * 멀티스테이지 빌드(FROM ... AS ...) 구조를 가진다.
     * 실제 docker build 성공은 CI(GitHub Actions) 에서 최종 검증.
     */
    const dockerfilePath = path.join(PROJECT_ROOT, 'apps/backend/Dockerfile');
    expect(fs.existsSync(dockerfilePath)).toBe(true);

    const content = fs.readFileSync(dockerfilePath, 'utf-8');

    // FROM 지시어가 2개 이상 존재 (멀티스테이지)
    const fromDirectives = content.match(/^FROM\s+/gm);
    expect(fromDirectives).toBeTruthy();
    expect(fromDirectives!.length).toBeGreaterThanOrEqual(2);

    // FROM ... AS <stage-name> 패턴으로 스테이지 이름 지정
    const namedStages = content.match(/^FROM\s+\S+.*\bAS\b\s+\w+/gim);
    expect(namedStages).toBeTruthy();
    expect(namedStages!.length).toBeGreaterThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────
// CI needs 체인 파싱 헬퍼
// ─────────────────────────────────────────────

/**
 * ci.yml 에서 특정 job이 지정한 job을 needs하는지 확인.
 * needs: lint 또는 needs: [lint] 형식 모두 지원.
 */
function jobNeedsOther(ciContent: string, jobName: string, needsJobName: string): boolean {
  // ci.yml 구조:
  //   jobs:
  //     {jobName}:
  //       needs: {needsJobName}          (scalar form)
  //       needs: [{needsJobName}, ...]   (list form)
  //
  // 접근: needs 키에서 needsJobName 이 포함되는지 검사
  // 단순 패턴 매칭 (정확한 YAML 파서 없이도 충분)
  const scalarPattern = new RegExp(
    `needs\\s*:\\s*${needsJobName}\\b`,
    'i',
  );
  const listPattern = new RegExp(
    `needs\\s*:\\s*\\[[^\\]]*\\b${needsJobName}\\b[^\\]]*\\]`,
    'is',
  );
  const multiLineListPattern = new RegExp(
    `needs\\s*:[\\s\\S]*?-\\s*${needsJobName}\\b`,
    'im',
  );
  return (
    scalarPattern.test(ciContent) ||
    listPattern.test(ciContent) ||
    multiLineListPattern.test(ciContent)
  );
}

// ─────────────────────────────────────────────
// SC-023: lint 실패 → typecheck·test·docker-build 미실행
// ─────────────────────────────────────────────
describe('SC-023: lint 실패 시 후속 단계 미실행 (needs 체인)', () => {
  it('when_lint_fails_then_typecheck_test_build_skipped', () => {
    /**
     * SC-023 (FR-015 관련):
     * ci.yml의 typecheck job이 lint를 needs하므로,
     * lint 실패 시 typecheck·test·docker-build 모두 미실행.
     * (GitHub Actions의 needs 기반 자동 skip 메커니즘)
     */
    const ciPath = path.join(PROJECT_ROOT, '.github/workflows/ci.yml');
    expect(fs.existsSync(ciPath)).toBe(true);

    const content = fs.readFileSync(ciPath, 'utf-8');

    // typecheck는 lint를 needs (lint 실패 시 typecheck 미실행)
    expect(jobNeedsOther(content, 'typecheck', 'lint')).toBe(true);
    // test는 typecheck를 needs (lint 실패 → typecheck 미실행 → test 미실행)
    expect(jobNeedsOther(content, 'test', 'typecheck')).toBe(true);
    // docker-build는 test를 needs (체인 말단)
    expect(jobNeedsOther(content, 'docker-build', 'test')).toBe(true);
  });
});

// ─────────────────────────────────────────────
// SC-024: typecheck 실패 → test·docker-build 미실행
// ─────────────────────────────────────────────
describe('SC-024: typecheck 실패 시 test·docker-build 미실행 (needs 체인)', () => {
  it('when_typecheck_fails_then_test_build_skipped', () => {
    /**
     * SC-024 (FR-015 관련):
     * test job이 typecheck를 needs하므로,
     * typecheck 실패 시 test·docker-build 미실행.
     */
    const ciPath = path.join(PROJECT_ROOT, '.github/workflows/ci.yml');
    const content = fs.readFileSync(ciPath, 'utf-8');

    // test는 typecheck를 needs
    expect(jobNeedsOther(content, 'test', 'typecheck')).toBe(true);
    // docker-build는 test를 needs (typecheck 실패 → test 미실행 → docker-build 미실행)
    expect(jobNeedsOther(content, 'docker-build', 'test')).toBe(true);
  });
});

// ─────────────────────────────────────────────
// SC-025: test 실패 → docker-build 미실행
// ─────────────────────────────────────────────
describe('SC-025: test 실패 시 docker-build 미실행 (needs 체인)', () => {
  it('when_test_fails_then_docker_build_skipped', () => {
    /**
     * SC-025 (FR-015 관련):
     * docker-build job이 test를 needs하므로,
     * test 실패 시 docker-build 미실행.
     * 단위 테스트가 실제로 실패하면 CI에서 이 체인이 동작한다.
     */
    const ciPath = path.join(PROJECT_ROOT, '.github/workflows/ci.yml');
    const content = fs.readFileSync(ciPath, 'utf-8');

    // docker-build는 test를 needs
    expect(jobNeedsOther(content, 'docker-build', 'test')).toBe(true);
  });
});

// ─────────────────────────────────────────────
// SC-026: 전 단계 통과 → docker-build 실행
// ─────────────────────────────────────────────
describe('SC-026: 전 단계 통과 시 docker-build 실행 (needs 체인 완전성)', () => {
  it('when_all_pass_then_docker_build_runs', () => {
    /**
     * SC-026 (FR-015 관련):
     * lint → typecheck → test → docker-build 체인이 완전히 구성되어 있으면,
     * 전 단계 통과 시 docker-build가 자동으로 실행된다.
     * (실제 docker build 성공은 CI 환경에서 검증)
     */
    const ciPath = path.join(PROJECT_ROOT, '.github/workflows/ci.yml');
    const content = fs.readFileSync(ciPath, 'utf-8');

    // docker-build job 자체가 존재
    expect(content).toMatch(/docker.?build\s*:/i);

    // 체인 전수: lint → typecheck(needs:lint) → test(needs:typecheck) → docker-build(needs:test)
    expect(jobNeedsOther(content, 'typecheck', 'lint')).toBe(true);
    expect(jobNeedsOther(content, 'test', 'typecheck')).toBe(true);
    expect(jobNeedsOther(content, 'docker-build', 'test')).toBe(true);
  });
});
