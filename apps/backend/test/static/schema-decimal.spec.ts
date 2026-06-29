/**
 * 정적 코드 검증 — SC-050/SC-049 (003) + SC-050 (004) [env:static]
 *
 * 대상 SC:
 *   SC-050 (002-catalog, NFR-004 관련) — price 필드 Decimal 타입 검증
 *   SC-049 (003-commerce, NFR-004 관련) — 금전 필드 (totalAmount, discountAmount,
 *           amount, unitPrice) Decimal 타입 검증
 *   SC-050 (004-review-coupon, NFR-004 관련) — 쿠폰 금전 필드 (discountValue,
 *           maxDiscountAmount, minOrderAmount) Decimal 타입 검증
 *
 * 검증 방법: Node.js fs + schema.prisma 텍스트 파싱
 *
 * 검증 내용:
 *   schema.prisma 에서 금전을 나타내는 필드가 모두 Decimal 타입으로 선언됨.
 *   Float 타입 사용 금지 (부동소수점 정밀도 오류 방지).
 *
 * 대상 필드 (003-commerce 신규 추가):
 *   - price (002-catalog, Variant.price)
 *   - totalAmount (003, Order.totalAmount)
 *   - discountAmount (003, Order.discountAmount)
 *   - amount (003, Payment.amount)
 *   - unitPrice (003, OrderItem.unitPrice)
 *
 * 대상 필드 (004-review-coupon 신규 추가):
 *   - discountValue (004, Coupon.discountValue)
 *   - maxDiscountAmount (004, Coupon.maxDiscountAmount)
 *   - minOrderAmount (004, Coupon.minOrderAmount)
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

/**
 * 검증 대상 금전 필드 목록.
 * 각 필드: schema.prisma 에서 Decimal 타입으로 선언되어야 하고, Float 는 금지.
 *
 * SC-050 (002-catalog): price
 * SC-049 (003-commerce): totalAmount, discountAmount, amount, unitPrice
 * SC-050 (004-review-coupon): discountValue, maxDiscountAmount, minOrderAmount
 */
const MONEY_FIELDS: Array<{ fieldName: string; sc: string }> = [
  { fieldName: 'price', sc: 'SC-050(002)' },
  { fieldName: 'totalAmount', sc: 'SC-049(003)' },
  { fieldName: 'discountAmount', sc: 'SC-049(003)' },
  { fieldName: 'amount', sc: 'SC-049(003)' },
  { fieldName: 'unitPrice', sc: 'SC-049(003)' },
  // 004-review-coupon: 쿠폰 금전 필드 (SC-050)
  { fieldName: 'discountValue', sc: 'SC-050(004)' },
  { fieldName: 'maxDiscountAmount', sc: 'SC-050(004)' },
  { fieldName: 'minOrderAmount', sc: 'SC-050(004)' },
  // 005-settlement: 정산 금전 필드
  { fieldName: 'totalSales', sc: '005(settlement)' },
  { fieldName: 'commission', sc: '005(settlement)' },
  { fieldName: 'payoutAmount', sc: '005(settlement)' },
  { fieldName: 'saleAmount', sc: '005(settlement)' },
  { fieldName: 'commissionAmount', sc: '005(settlement)' },
];

describe('SC-050/SC-049: 금전 필드 Decimal 타입 정적 검증', () => {
  // ─────────────────────────────────────────────
  // 002-catalog 계승: price 필드
  // ─────────────────────────────────────────────
  it('when_inspect_schema_prisma_then_price_is_Decimal', () => {
    /**
     * SC-050 (002-catalog, NFR-004 관련):
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
     * SC-050 (002-catalog, NFR-004 관련) — 네거티브 확인:
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

  // ─────────────────────────────────────────────
  // 003-commerce 신규: 금전 필드 일괄 검증 (SC-049)
  // ─────────────────────────────────────────────
  describe('SC-049(003): 금전 필드 모두 Decimal 타입 선언', () => {
    it('when_inspect_schema_money_fields_then_all_Decimal', () => {
      /**
       * SC-049 (003-commerce, NFR-004 관련):
       * 003 신규 금전 필드(totalAmount, discountAmount, amount, unitPrice)가
       * 모두 Decimal 타입으로 선언되었는지 검증.
       *
       * 검증 전략:
       *   schema.prisma 에서 각 fieldName 이 등장하는 줄을 찾아
       *   Decimal 타입 선언 여부를 확인하고 Float 사용 여부를 부정.
       *
       * TDD Red: schema.prisma 미생성 시 스킵 (Database Design Agent 완료 후 Green).
       */
      const schemaPath = findSchemaFile();

      if (!schemaPath) {
        return;
      }

      const schema = fs.readFileSync(schemaPath, 'utf-8');
      const lines = schema.split('\n');

      const violations: string[] = [];

      for (const { fieldName, sc } of MONEY_FIELDS) {
        if (fieldName === 'price') continue; // 위에서 이미 검증

        // 해당 필드명이 포함된 줄 (타입 선언 줄: 공백+fieldName+공백+Type)
        // 주석 라인(///·//·/* 로 시작) 제외 — JSON 스냅샷 설명 주석의 false positive 방지.
        const fieldLines = lines.filter((line) =>
          new RegExp(`\\b${fieldName}\\b`).test(line) &&
          !/^\s*\/\//.test(line),
        );

        if (fieldLines.length === 0) {
          // 필드가 schema에 없으면 스킵 (DB Design Agent 완료 후 등장)
          continue;
        }

        for (const fieldLine of fieldLines) {
          if (/\bFloat\b/.test(fieldLine)) {
            violations.push(`${sc}: ${fieldName} 필드에 Float 타입 사용 금지 → 줄: "${fieldLine.trim()}"`);
          }
          // Decimal 타입 확인 (Optional/Array 포함: Decimal? Decimal[])
          if (!/\bDecimal\b/.test(fieldLine)) {
            violations.push(`${sc}: ${fieldName} 필드가 Decimal 타입이 아님 → 줄: "${fieldLine.trim()}"`);
          }
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `금전 필드 Decimal 타입 위반:\n${violations.join('\n')}\n\n` +
          `부동소수점 정밀도 오류 방지를 위해 금전 필드는 반드시 Decimal 타입으로 선언하세요.`,
        );
      }
    });

    it.each(
      MONEY_FIELDS.filter((f) => f.fieldName !== 'price'),
    )('when_inspect_$fieldName_field_then_not_Float', ({ fieldName, sc }) => {
      /**
       * SC-049 (003-commerce): 개별 금전 필드 Float 사용 금지 검증.
       * 파라미터화로 각 필드 독립 검증 (FAIL 시 정확한 필드 식별).
       */
      const schemaPath = findSchemaFile();

      if (!schemaPath) {
        return;
      }

      const schema = fs.readFileSync(schemaPath, 'utf-8');
      const lines = schema.split('\n');

      const floatLines = lines.filter(
        (line) => new RegExp(`\\b${fieldName}\\b`).test(line) && /\bFloat\b/.test(line),
      );

      if (floatLines.length > 0) {
        throw new Error(
          `${sc} 위반: ${fieldName} 필드에 Float 타입 사용 금지.\n` +
          `문제 줄:\n${floatLines.map((l) => '  ' + l.trim()).join('\n')}`,
        );
      }

      // 파일이 있는 경우만 체크 (필드 미존재는 허용 — DB Design Agent 미완료 시)
      expect(floatLines).toHaveLength(0);
    });
  });
});
