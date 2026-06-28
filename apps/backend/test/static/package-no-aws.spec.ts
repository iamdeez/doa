/**
 * 정적 코드 검증 — SC-051 [env:static]
 *
 * 대상 SC: SC-051 (NFR-005 관련)
 * 검증 방법: Node.js fs + package.json 텍스트 파싱
 *
 * 검증 내용:
 *   apps/backend/package.json 의 dependencies·devDependencies 에
 *   @aws-sdk/* 패키지가 신규로 추가되지 않았음을 확인.
 *
 * 실행: 앱 기동·DB 연결 불필요. 파일 텍스트 검증만.
 */

import * as fs from 'fs';
import * as path from 'path';

const BACKEND_ROOT = path.resolve(__dirname, '../../');
const PACKAGE_JSON_PATH = path.join(BACKEND_ROOT, 'package.json');

describe('SC-051: @aws-sdk/* 신규 의존 없음 정적 검증', () => {
  it('when_inspect_package_json_then_no_aws_sdk_packages', () => {
    /**
     * SC-051 (NFR-005 관련):
     * apps/backend/package.json 에 @aws-sdk/* 패키지가 없어야 한다.
     * constitution P-002: AWS 전용 SDK·서비스 신규 의존 추가 금지.
     *
     * 검증 전략:
     *   package.json 을 파싱하여 dependencies + devDependencies 의
     *   모든 키 중 "@aws-sdk/" 로 시작하는 것이 없음을 확인.
     */
    expect(fs.existsSync(PACKAGE_JSON_PATH)).toBe(true);

    const rawJson = fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8');
    const pkg = JSON.parse(rawJson) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };

    const allDeps = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
      ...Object.keys(pkg.peerDependencies ?? {}),
    ];

    const awsSdkDeps = allDeps.filter((dep) => dep.startsWith('@aws-sdk/'));

    if (awsSdkDeps.length > 0) {
      // 위반 목록을 메시지에 포함하여 디버깅 편의 제공
      throw new Error(
        `SC-051 위반: @aws-sdk/* 패키지가 발견됨:\n${awsSdkDeps.join('\n')}`,
      );
    }

    expect(awsSdkDeps).toHaveLength(0);
  });

  it('when_inspect_package_json_then_no_aws_string_anywhere_in_deps', () => {
    /**
     * SC-051 (NFR-005 관련) — 추가 확인:
     * aws-sdk (v2) 또는 amazon 접두어 패키지도 없어야 한다.
     * @aws-sdk/* (v3 modular) 외 레거시 패키지도 포함.
     */
    const rawJson = fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8');
    const pkg = JSON.parse(rawJson) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const allDeps = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ];

    // aws-sdk (v2 레거시) 또는 @aws-amplify, amazon-cognito 등
    const awsRelatedDeps = allDeps.filter(
      (dep) => dep === 'aws-sdk' || dep.startsWith('@aws-') || dep.startsWith('amazon-'),
    );

    expect(awsRelatedDeps).toHaveLength(0);
  });
});
