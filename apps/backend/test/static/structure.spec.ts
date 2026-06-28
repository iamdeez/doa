/**
 * 정적 구조 검증 테스트 — [env:static]
 *
 * 대상 SC: SC-001, SC-003, SC-004, SC-005
 * 검증 방법: Node.js fs 모듈로 파일/디렉토리 존재 및 텍스트 파싱
 *
 * 실행: pnpm --filter backend test (또는 turbo run test --filter=backend)
 * 주의: 앱 기동·DB 연결 불필요. 파일 시스템 검증만 수행.
 */

import * as fs from 'fs';
import * as path from 'path';

// apps/backend/test/static/ → 4단계 상위 = 프로젝트 루트
const PROJECT_ROOT = path.resolve(__dirname, '../../../../');
// apps/backend/test/static/ → 2단계 상위 = apps/backend
const BACKEND_ROOT = path.resolve(__dirname, '../../');

// ─────────────────────────────────────────────
// SC-001: 모노레포 구조·6 워크스페이스 존재
// ─────────────────────────────────────────────
describe('SC-001: 모노레포 구조·6 워크스페이스 존재', () => {
  it('when_repo_root_then_workspaces_and_turbo_exist', () => {
    /**
     * SC-001 (FR-001 관련):
     * pnpm install 성공 전제: pnpm-workspace.yaml + turbo.json 존재,
     * 6개 워크스페이스 폴더 모두 존재.
     */
    // 루트 구성 파일
    expect(fs.existsSync(path.join(PROJECT_ROOT, 'pnpm-workspace.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(PROJECT_ROOT, 'turbo.json'))).toBe(true);

    // 6개 워크스페이스 폴더
    const workspaces = [
      'apps/backend',
      'apps/console',
      'apps/worker',
      'packages/shared-types',
      'packages/api-client',
      'packages/ui',
    ];
    for (const ws of workspaces) {
      expect(fs.existsSync(path.join(PROJECT_ROOT, ws))).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────
// SC-003: 18 도메인 모듈 4계층 골격 존재
// ─────────────────────────────────────────────
describe('SC-003: 18 도메인 모듈 4계층 골격', () => {
  it('when_modules_dir_then_18_dirs_with_4_layers', () => {
    /**
     * SC-003 (FR-003 관련):
     * apps/backend/src/modules/ 하위 18개 도메인 디렉토리 전부 존재,
     * 각 디렉토리에 controller·service·repository 파일 + events 파일(또는 디렉토리) 존재.
     */
    const DOMAIN_MODULES = [
      'auth',
      'user',
      'seller',
      'product',
      'inventory',
      'cart',
      'coupon',
      'order',
      'payment',
      'shipping',
      'settlement',
      'review',
      'search',
      'notification',
      'file',
      'banner',
      'stats',
      'admin',
    ];
    expect(DOMAIN_MODULES).toHaveLength(18);

    const modulesDir = path.join(BACKEND_ROOT, 'src/modules');
    expect(fs.existsSync(modulesDir)).toBe(true);

    for (const mod of DOMAIN_MODULES) {
      const modDir = path.join(modulesDir, mod);
      expect(fs.existsSync(modDir)).toBe(true);

      // 4계층: controller·service·repository 파일
      expect(fs.existsSync(path.join(modDir, `${mod}.controller.ts`))).toBe(true);
      expect(fs.existsSync(path.join(modDir, `${mod}.service.ts`))).toBe(true);
      expect(fs.existsSync(path.join(modDir, `${mod}.repository.ts`))).toBe(true);

      // events: 파일 또는 디렉토리 중 하나 존재
      const eventsFile = path.join(modDir, `${mod}.events.ts`);
      const eventsDir = path.join(modDir, 'events');
      const eventsExist = fs.existsSync(eventsFile) || fs.existsSync(eventsDir);
      expect(eventsExist).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────
// SC-004: schema.prisma — 8개 스키마 선언
// ─────────────────────────────────────────────
describe('SC-004: schema.prisma 8 스키마 선언', () => {
  it('when_schema_prisma_then_8_schemas_declared', () => {
    /**
     * SC-004 (FR-004 관련):
     * datasource db의 schemas 배열에
     * users, products, commerce, orders, payments, settlements, admin, files
     * 8개 스키마가 모두 선언되어 있어야 한다.
     */
    const schemaPath = path.join(BACKEND_ROOT, 'prisma/schema.prisma');
    expect(fs.existsSync(schemaPath)).toBe(true);

    const content = fs.readFileSync(schemaPath, 'utf-8');

    // datasource db 블록에 schemas 배열 존재
    expect(content).toMatch(/datasource\s+db\s*\{/);

    // schemas 배열 추출 (datasource 블록 내)
    const schemasMatch = content.match(/schemas\s*=\s*\[([^\]]+)\]/s);
    expect(schemasMatch).toBeTruthy();

    const schemasDeclaration = schemasMatch![1];
    const REQUIRED_SCHEMAS = [
      'users',
      'products',
      'commerce',
      'orders',
      'payments',
      'settlements',
      'admin',
      'files',
    ];
    for (const schema of REQUIRED_SCHEMAS) {
      expect(schemasDeclaration).toContain(schema);
    }
  });
});

// ─────────────────────────────────────────────
// SC-005: users 스키마 — User + RefreshToken 모델 정의
// ─────────────────────────────────────────────
describe('SC-005: users 스키마 2 테이블 정의', () => {
  it('when_schema_prisma_then_user_and_refreshtoken_models', () => {
    /**
     * SC-005 (FR-005 관련):
     * schema.prisma에 User 모델과 RefreshToken 모델이 정의되어 있어야 한다.
     * User: email, password(해시), createdAt 필드 포함.
     * RefreshToken: tokenHash(SHA-256), expiresAt, revoked 필드 포함.
     * 두 모델 모두 @@schema("users") 선언.
     */
    const schemaPath = path.join(BACKEND_ROOT, 'prisma/schema.prisma');
    const content = fs.readFileSync(schemaPath, 'utf-8');

    // User 모델 정의 존재
    expect(content).toMatch(/model\s+User\s*\{/);

    // RefreshToken 모델 정의 존재
    expect(content).toMatch(/model\s+RefreshToken\s*\{/);

    // User 모델 필수 필드
    // email (unique), password (bcrypt 해시), createdAt
    expect(content).toMatch(/\bemail\b/);
    expect(content).toMatch(/\bpassword\b/);
    expect(content).toMatch(/\bcreatedAt\b/);

    // RefreshToken 모델 필수 필드
    // tokenHash (SHA-256, 원문 미저장 — ADR-003), expiresAt, revoked
    expect(content).toMatch(/\btokenHash\b/);
    expect(content).toMatch(/\bexpiresAt\b/);
    expect(content).toMatch(/\brevoked\b/);

    // 두 모델 모두 @@schema("users") 로 users 스키마에 매핑
    const schemaAnnotations = content.match(/@@schema\(["']users["']\)/g);
    expect(schemaAnnotations).toBeTruthy();
    // User + RefreshToken = 최소 2개
    expect(schemaAnnotations!.length).toBeGreaterThanOrEqual(2);
  });
});
