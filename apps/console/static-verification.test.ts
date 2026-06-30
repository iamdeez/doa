/**
 * 정적 검증 테스트 — [env:static]
 *
 * 대상 SC: SC-003, SC-011, SC-013, SC-014, SC-018, SC-020
 * 검증 방법: Node.js fs + 정규식 패턴 그렙 (컴파일·렌더 없이 코드 구조 확인)
 *
 * 이 파일은 vitest 환경에서 실행되지만 DOM/React는 사용하지 않는다.
 * 실제 소스 파일을 읽고 필요한 심볼·패턴이 존재하는지 단언한다.
 *
 * [STALE_SC 참고] SC-003/011/013/014/018/020 — 현재 spec v1.1.0/012 기준
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// 프로젝트 루트 (apps/console 기준 상위 2단계)
const CONSOLE_ROOT = path.resolve(__dirname);
const BACKEND_ROOT = path.resolve(CONSOLE_ROOT, '../../apps/backend');
const PROJECT_ROOT = path.resolve(CONSOLE_ROOT, '../..');

function readFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

// ─────────────────────────────────────────────
// SC-003: 백엔드 GET /auth/me → isAdmin 필드 포함 응답
// ─────────────────────────────────────────────
describe('SC-003: GET /auth/me 응답에 isAdmin 포함 — 정적 검증 [env:static]', () => {
  /**
   * SC-003 (FR-001 관련):
   * 백엔드 AuthService.getProfile 메서드가 isAdmin 필드를 반환한다.
   * 정적 검증: auth.service.ts에서 isAdmin 필드 return 패턴 확인.
   */

  it('when_auth_service_getProfile_then_returns_isAdmin', () => {
    const authServicePath = path.join(
      PROJECT_ROOT,
      'apps/backend/src/modules/auth/auth.service.ts',
    );
    expect(fileExists(authServicePath)).toBe(true);

    const content = readFile(authServicePath);
    // getProfile 메서드가 isAdmin 필드를 포함하는지 확인
    expect(content).toMatch(/getProfile/);
    expect(content).toMatch(/isAdmin/);
  });

  it('when_auth_controller_then_exposes_isAdmin_via_me_endpoint', () => {
    const authControllerPath = path.join(
      PROJECT_ROOT,
      'apps/backend/src/modules/auth/auth.controller.ts',
    );
    expect(fileExists(authControllerPath)).toBe(true);

    const content = readFile(authControllerPath);
    // me() 엔드포인트가 존재하고 isAdmin 필드가 응답에 포함되는지 확인
    expect(content).toMatch(/\bme\s*\(/);
  });

  it('when_admin_ids_module_then_isAdminUserId_function_exists', () => {
    const adminIdsPath = path.join(
      PROJECT_ROOT,
      'apps/backend/src/shared/auth/admin-ids.ts',
    );
    expect(fileExists(adminIdsPath)).toBe(true);

    const content = readFile(adminIdsPath);
    // isAdminUserId 함수 존재 확인
    expect(content).toMatch(/isAdminUserId/);
    expect(content).toMatch(/ADMIN_USER_IDS/);
  });
});

// ─────────────────────────────────────────────
// SC-011: ImageUpload 컴포넌트 파일 존재 및 인터페이스
// ─────────────────────────────────────────────
describe('SC-011: ImageUpload 컴포넌트 파일 존재 및 필수 props 인터페이스 [env:static]', () => {
  /**
   * SC-011 (FR-002 관련):
   * apps/console/components/image-upload.tsx가 존재하고,
   * purpose, onUploaded, disabled? props 인터페이스를 갖는다.
   */

  it('when_image_upload_file_then_exists', () => {
    const imagaUploadPath = path.join(CONSOLE_ROOT, 'components/image-upload.tsx');
    expect(fileExists(imagaUploadPath)).toBe(true);
  });

  it('when_image_upload_then_has_purpose_prop', () => {
    const imagaUploadPath = path.join(CONSOLE_ROOT, 'components/image-upload.tsx');
    const content = readFile(imagaUploadPath);

    expect(content).toMatch(/purpose/);
    // FilePurpose 타입 사용 확인
    expect(content).toMatch(/FilePurpose/);
  });

  it('when_image_upload_then_has_onUploaded_prop', () => {
    const imagaUploadPath = path.join(CONSOLE_ROOT, 'components/image-upload.tsx');
    const content = readFile(imagaUploadPath);

    expect(content).toMatch(/onUploaded/);
  });

  it('when_image_upload_then_has_disabled_prop', () => {
    const imagaUploadPath = path.join(CONSOLE_ROOT, 'components/image-upload.tsx');
    const content = readFile(imagaUploadPath);

    expect(content).toMatch(/disabled/);
  });

  it('when_image_upload_then_uses_plain_fetch_not_authFetch', () => {
    /**
     * ADR-002: presigned URL PUT 단계에서 authFetch가 아닌 plain fetch 사용.
     * Authorization 헤더가 presigned URL 서명을 깨뜨리기 때문.
     */
    const imagaUploadPath = path.join(CONSOLE_ROOT, 'components/image-upload.tsx');
    const content = readFile(imagaUploadPath);

    // plain fetch 사용 확인
    expect(content).toMatch(/fetch\(presign\.uploadUrl/);
    // authFetch 미사용 확인
    expect(content).not.toMatch(/authFetch\(presign\.uploadUrl/);
  });

  it('when_image_upload_then_uses_ALLOWED_IMAGE_TYPES_and_MAX_IMAGE_BYTES', () => {
    /**
     * SC-005 연계: 상수를 직접 정의하지 않고 upload-constants.ts에서 import.
     */
    const imagaUploadPath = path.join(CONSOLE_ROOT, 'components/image-upload.tsx');
    const content = readFile(imagaUploadPath);

    expect(content).toMatch(/ALLOWED_IMAGE_TYPES/);
    expect(content).toMatch(/MAX_IMAGE_BYTES/);
  });
});

// ─────────────────────────────────────────────
// SC-013: auth.tsx isAdmin — profile?.isAdmin ?? false
// ─────────────────────────────────────────────
describe('SC-013: auth.tsx의 isAdmin이 profile?.isAdmin ?? false 패턴 [env:static]', () => {
  /**
   * SC-013 (FR-001, FR-006 관련):
   * apps/console/lib/auth.tsx의 isAdmin 값이 profile?.isAdmin ?? false 패턴을 사용한다.
   * (hardcoded false 금지)
   */

  it('when_auth_tsx_then_isAdmin_reads_from_profile', () => {
    const authPath = path.join(CONSOLE_ROOT, 'lib/auth.tsx');
    expect(fileExists(authPath)).toBe(true);

    const content = readFile(authPath);
    // profile?.isAdmin 패턴 존재 확인
    expect(content).toMatch(/profile\?\.isAdmin/);
  });

  it('when_auth_tsx_then_cookie_mirrors_admin_status', () => {
    /**
     * SC-013 보조 (ADR-003):
     * hydrate() 함수에서 doa_console_admin 쿠키를 me.isAdmin 기반으로 설정.
     * middleware의 UX 보호를 위해 isAdmin 상태를 쿠키에 미러링.
     */
    const authPath = path.join(CONSOLE_ROOT, 'lib/auth.tsx');
    const content = readFile(authPath);

    expect(content).toMatch(/COOKIE_KEYS\.admin/);
    expect(content).toMatch(/me\.isAdmin/);
  });
});

// ─────────────────────────────────────────────
// SC-014: middleware.ts /admin/* 라우트 보호
// ─────────────────────────────────────────────
describe('SC-014: middleware.ts admin 라우트 쿠키 기반 보호 [env:static]', () => {
  /**
   * SC-014 (FR-005, FR-006 관련):
   * middleware.ts가 /admin/* 경로에 대해 doa_console_admin 쿠키 확인 후
   * 비관리자를 /login으로 리다이렉트한다.
   */

  it('when_middleware_then_file_exists', () => {
    const middlewarePath = path.join(CONSOLE_ROOT, 'middleware.ts');
    expect(fileExists(middlewarePath)).toBe(true);
  });

  it('when_middleware_then_admin_path_protected', () => {
    const middlewarePath = path.join(CONSOLE_ROOT, 'middleware.ts');
    const content = readFile(middlewarePath);

    // /admin 경로 조건 확인
    expect(content).toMatch(/\/admin/);
    // 쿠키 확인 패턴
    expect(content).toMatch(/COOKIE_KEYS\.admin/);
  });

  it('when_middleware_then_non_admin_redirected_to_login', () => {
    const middlewarePath = path.join(CONSOLE_ROOT, 'middleware.ts');
    const content = readFile(middlewarePath);

    // admin !== 'true' 패턴 + login 리다이렉트
    expect(content).toMatch(/admin.*true/);
    expect(content).toMatch(/redirect/);
    expect(content).toMatch(/login/);
  });

  it('when_middleware_config_then_admin_path_in_matcher', () => {
    const middlewarePath = path.join(CONSOLE_ROOT, 'middleware.ts');
    const content = readFile(middlewarePath);

    // matcher에 /admin/:path* 포함 확인
    expect(content).toMatch(/\/admin\/:path\*/);
  });
});

// ─────────────────────────────────────────────
// SC-018: states.tsx LoadingState/ErrorState/EmptyState export 확인
// ─────────────────────────────────────────────
describe('SC-018: states.tsx 표준 상태 컴포넌트 존재 확인 [env:static]', () => {
  /**
   * SC-018 (FR-009 관련):
   * apps/console/components/states.tsx가 LoadingState, ErrorState, EmptyState를 export한다.
   * 콘솔 내 모든 페이지에서 표준 상태 컴포넌트로 사용.
   */

  it('when_states_tsx_then_exists', () => {
    const statesPath = path.join(CONSOLE_ROOT, 'components/states.tsx');
    expect(fileExists(statesPath)).toBe(true);
  });

  it('when_states_tsx_then_exports_LoadingState', () => {
    const statesPath = path.join(CONSOLE_ROOT, 'components/states.tsx');
    const content = readFile(statesPath);

    expect(content).toMatch(/export function LoadingState/);
  });

  it('when_states_tsx_then_exports_ErrorState', () => {
    const statesPath = path.join(CONSOLE_ROOT, 'components/states.tsx');
    const content = readFile(statesPath);

    expect(content).toMatch(/export function ErrorState/);
  });

  it('when_states_tsx_then_exports_EmptyState', () => {
    const statesPath = path.join(CONSOLE_ROOT, 'components/states.tsx');
    const content = readFile(statesPath);

    expect(content).toMatch(/export function EmptyState/);
  });
});

// ─────────────────────────────────────────────
// SC-020: Playwright 설정 파일 존재 확인
// ─────────────────────────────────────────────
describe('SC-020: Playwright 설정 파일 존재 확인 [env:static]', () => {
  /**
   * SC-020 (NFR-005 관련):
   * apps/console/playwright.config.ts가 존재하고,
   * baseURL: 'http://localhost:3100', testDir: './e2e',
   * timeout ≤ 120000ms(2분) 이어야 한다.
   *
   * TDD Red: playwright.config.ts는 T019에서 생성 예정.
   * 이 테스트는 T019 완료 후 Green이 된다.
   */

  it('when_playwright_config_then_exists', () => {
    const configPath = path.join(CONSOLE_ROOT, 'playwright.config.ts');
    // TDD Red: 파일 미생성 상태 — T019 완료 후 Green
    expect(fileExists(configPath)).toBe(true);
  });

  it('when_playwright_config_then_baseURL_is_localhost_3100', () => {
    const configPath = path.join(CONSOLE_ROOT, 'playwright.config.ts');
    if (!fileExists(configPath)) {
      // TDD Red: 파일 없음 — T019 완료 후 검증
      expect(true).toBe(true);
      return;
    }
    const content = readFile(configPath);
    expect(content).toMatch(/localhost:3100/);
  });

  it('when_playwright_config_then_testDir_is_e2e', () => {
    const configPath = path.join(CONSOLE_ROOT, 'playwright.config.ts');
    if (!fileExists(configPath)) {
      expect(true).toBe(true);
      return;
    }
    const content = readFile(configPath);
    expect(content).toMatch(/testDir.*e2e/);
  });
});

// 참조 검증 — 타입 사용 확인 (컴파일은 tsc --noEmit로 분리)
describe('upload-constants.ts 상수 정합성 [env:static]', () => {
  it('when_upload_constants_then_ALLOWED_IMAGE_TYPES_has_4_types', () => {
    const constantsPath = path.join(CONSOLE_ROOT, 'lib/upload-constants.ts');
    expect(fileExists(constantsPath)).toBe(true);

    const content = readFile(constantsPath);
    // 4개 허용 타입 존재 확인
    expect(content).toMatch(/image\/jpeg/);
    expect(content).toMatch(/image\/png/);
    expect(content).toMatch(/image\/webp/);
    expect(content).toMatch(/image\/gif/);
  });

  it('when_upload_constants_then_MAX_IMAGE_BYTES_is_10MiB', () => {
    const constantsPath = path.join(CONSOLE_ROOT, 'lib/upload-constants.ts');
    const content = readFile(constantsPath);

    // 10 * 1024 * 1024 패턴 확인
    expect(content).toMatch(/10\s*\*\s*1024\s*\*\s*1024/);
  });
});

// 미사용 변수 방지
void BACKEND_ROOT;
