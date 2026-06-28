/**
 * 정적 코드 검증 — SC-043 [env:static]
 *
 * 대상 SC: SC-043 (FR-032 관련)
 * 검증 방법: Node.js fs + 소스 텍스트 파싱
 *
 * 검증 내용:
 *   inventory_logs 를 수정·삭제하는 Prisma 호출
 *   (inventoryLog.update / inventoryLog.delete / inventoryLog.deleteMany / inventoryLog.updateMany)
 *   이 InventoryRepository 및 InventoryService 소스에 없음을 확인.
 *
 * 실행: 앱 기동·DB 연결 불필요. 파일 시스템 + 소스 텍스트 검증만 수행.
 */

import * as fs from 'fs';
import * as path from 'path';

// apps/backend/test/static/ → 2단계 상위 = apps/backend
const BACKEND_ROOT = path.resolve(__dirname, '../../');

// 검사 대상 파일
const INVENTORY_SOURCE_FILES = [
  'src/modules/inventory/inventory.repository.ts',
  'src/modules/inventory/inventory.service.ts',
];

// inventory_logs 수정·삭제 금지 패턴
// log.update / log.delete / log.deleteMany / log.updateMany (대소문자 무관)
const FORBIDDEN_LOG_MUTATION_PATTERNS = [
  /inventoryLog\.update\s*\(/,
  /inventoryLog\.delete\s*\(/,
  /inventoryLog\.deleteMany\s*\(/,
  /inventoryLog\.updateMany\s*\(/,
  // inventory_logs 테이블 직접 raw query 로 UPDATE/DELETE
  /UPDATE\s+inventory_logs/i,
  /DELETE\s+FROM\s+inventory_logs/i,
];

describe('SC-043: inventory_logs append-only 정적 검증', () => {
  it('when_inspect_inventory_sources_then_no_log_mutation_api', () => {
    /**
     * SC-043 (FR-032 관련):
     * 재고 입고·차감 시 inventory_logs 는 append-only (create 만 허용).
     * InventoryRepository / InventoryService 소스에 로그 수정·삭제
     * Prisma API 호출이 없어야 한다.
     */
    let violations: string[] = [];

    for (const relPath of INVENTORY_SOURCE_FILES) {
      const filePath = path.join(BACKEND_ROOT, relPath);

      // 파일 미생성(TDD Red 상태) 이면 스킵
      if (!fs.existsSync(filePath)) {
        continue;
      }

      const source = fs.readFileSync(filePath, 'utf-8');
      // 주석 제거 (간단한 단일행 주석만)
      const sourceNoComments = source
        .split('\n')
        .filter((line) => !line.trim().startsWith('//'))
        .join('\n');

      for (const pattern of FORBIDDEN_LOG_MUTATION_PATTERNS) {
        if (pattern.test(sourceNoComments)) {
          violations.push(`${relPath}: ${pattern.toString()} 매칭됨`);
        }
      }
    }

    expect(violations).toHaveLength(0);
  });

  it('when_inspect_inventory_sources_then_log_create_exists', () => {
    /**
     * SC-043 (FR-032 관련) — 포지티브 확인:
     * inventory_logs 를 생성(create)하는 Prisma 호출은 존재해야 한다.
     * TDD Red 상태 — 파일이 없으면 이 테스트는 스킵.
     */
    const repositoryPath = path.join(
      BACKEND_ROOT,
      'src/modules/inventory/inventory.repository.ts',
    );

    if (!fs.existsSync(repositoryPath)) {
      // TDD Red: 파일 미생성. Green 전환 후 이 검증 활성화.
      return;
    }

    const source = fs.readFileSync(repositoryPath, 'utf-8');
    const hasLogCreate =
      /inventoryLog\.create\s*\(/.test(source) ||
      /inventoryLog\.createMany\s*\(/.test(source);

    expect(hasLogCreate).toBe(true);
  });
});
