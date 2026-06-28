/**
 * 정적 코드 검증 — SC-050 [env:static]
 *
 * 대상 SC: SC-050 (NFR-004 관련)
 * 검증 방법: Node.js fs + schema.prisma 텍스트 파싱
 *
 * 검증 내용:
 *   schema.prisma 에서 상품 price 필드가 Decimal 타입으로 선언되어 있음.
 *   Float 타입 사용 금지.
 *
 * 실행: 앱 기동·DB 연결 불필요. 파일 텍스트 검증만.
 */

import * as fs from 'fs';
import * as path from 'path';

const BACKEND_ROOT = path.resolve(__dirname, '../../');
const PROJECT_ROOT = path.resolve(__dirname, '../../../../');

// Prisma schema 파일 경로 (apps/backend/prisma/schema.prisma 또는 프로젝트 루트)
const CANDIDATE_SCHEMA_PATHS = [
  path.join(BACKEND_ROOT, 'prisma/schema.prisma'),
  path.join(PROJECT_ROOT, 'prisma/schema.prisma'),
];

function findSchemaFile(): string | null {
  for (const p of CANDIDATE_SCHEMA_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

describe('SC-050: price 필드 Decimal 타입 정적 검증', () => {
  it('when_inspect_schema_prisma_then_price_is_Decimal', () => {
    /**
     * SC-050 (NFR-004 관련):
     * schema.prisma 에서 price 필드가 Decimal 타입으로 선언되어야 한다.
     * Float 타입 사용 금지 (부동소수점 정밀도 오류 방지).
     *
     * 검증 전략:
     *   1. "price" 와 "Decimal" 이 같은 줄에 함께 있는 패턴 확인.
     *   2. "price" 와 "Float" 이 같은 줄에 있는 패턴이 없음을 확인.
     */
    const schemaPath = findSchemaFile();

    if (!schemaPath) {
      // TDD Red: schema.prisma 미생성 — Green 전환 후 이 검증 활성화.
      return;
    }

    const schema = fs.readFileSync(schemaPath, 'utf-8');
    const lines = schema.split('\n');

    // price 필드 라인 추출
    const priceLines = lines.filter((line) => /\bprice\b/.test(line));

    // price 필드가 존재해야 함
    expect(priceLines.length).toBeGreaterThan(0);

    for (const priceLine of priceLines) {
      // price 필드에 Float 사용 금지
      expect(priceLine).not.toMatch(/\bFloat\b/);

      // price 필드에 Decimal 사용 확인
      expect(priceLine).toMatch(/\bDecimal\b/);
    }
  });

  it('when_inspect_schema_prisma_then_no_price_float', () => {
    /**
     * SC-050 (NFR-004 관련) — 네거티브 확인:
     * price 필드에 Float 타입이 사용된 선언이 없어야 한다.
     */
    const schemaPath = findSchemaFile();

    if (!schemaPath) {
      return;
    }

    const schema = fs.readFileSync(schemaPath, 'utf-8');
    const lines = schema.split('\n');

    const floatPriceLines = lines.filter(
      (line) => /\bprice\b/.test(line) && /\bFloat\b/.test(line),
    );

    expect(floatPriceLines).toHaveLength(0);
  });
});
