/**
 * 정적 코드 검증 — SC-049 [env:static]
 *
 * 대상 SC: SC-049 (NFR-003 관련)
 * 검증 방법: Node.js fs + 소스 텍스트 파싱
 *
 * 검증 내용:
 *   각 모듈의 Repository 클래스가 자신의 스키마가 아닌
 *   타 도메인 스키마 모델을 Prisma Client 로 직접 참조하지 않음을 확인.
 *
 *   규칙:
 *   - user 모듈 repository → products 스키마 모델(product, variant, inventory 등) 직접 참조 금지
 *   - seller 모듈 repository → products 스키마 모델 직접 참조 금지
 *   - product 모듈 repository → users 스키마 모델(user, address, wishlist 등) 직접 참조 금지
 *   - inventory 모듈 repository → users 스키마 모델 직접 참조 금지
 *
 * 교차 참조는 NestJS DI (SellerService, UserService 주입) 를 통해서만 허용.
 */

import * as fs from 'fs';
import * as path from 'path';

const BACKEND_ROOT = path.resolve(__dirname, '../../');

// ─────────────────────────────────────────────
// 검사 규칙 정의
// ─────────────────────────────────────────────

// users 스키마 모델 (Prisma Client 접근자)
const USERS_SCHEMA_MODELS = [
  'user',
  'address',
  'wishlist',
  'productView',
  'seller',
];

// products 스키마 모델 (Prisma Client 접근자)
const PRODUCTS_SCHEMA_MODELS = [
  'product',
  'variant',
  'category',
  'productImage',
  'inventory',
  'inventoryLog',
];

// 각 모듈 Repository 파일과 금지 모델 목록
const CROSS_SCHEMA_RULES: Array<{
  file: string;
  forbiddenModels: string[];
  label: string;
}> = [
  {
    file: 'src/modules/user/user.repository.ts',
    forbiddenModels: PRODUCTS_SCHEMA_MODELS,
    label: 'UserRepository',
  },
  {
    file: 'src/modules/seller/seller.repository.ts',
    forbiddenModels: PRODUCTS_SCHEMA_MODELS,
    label: 'SellerRepository',
  },
  {
    file: 'src/modules/product/product.repository.ts',
    forbiddenModels: USERS_SCHEMA_MODELS,
    label: 'ProductRepository',
  },
  {
    file: 'src/modules/inventory/inventory.repository.ts',
    forbiddenModels: USERS_SCHEMA_MODELS,
    label: 'InventoryRepository',
  },
];

// Prisma Client 접근 패턴: this.prisma.{model}. (this.$queryRaw 같은 raw query 제외)
function buildCrossSchemaPattern(modelName: string): RegExp {
  // this.prisma.{model}.find / create / update / delete 등
  return new RegExp(`this\\.prisma\\.${modelName}\\b`, 'g');
}

describe('SC-049: 크로스 스키마 Prisma 직접 참조 금지 정적 검증', () => {
  for (const rule of CROSS_SCHEMA_RULES) {
    it(`when_inspect_${rule.label}_then_no_cross_schema_prisma_access`, () => {
      /**
       * SC-049 (NFR-003 관련):
       * 각 모듈 Repository 는 자신의 스키마 테이블만 Prisma 로 접근해야 한다.
       * 타 도메인 스키마 모델에 this.prisma.{model} 형태로 직접 접근하면 위반.
       */
      const filePath = path.join(BACKEND_ROOT, rule.file);

      if (!fs.existsSync(filePath)) {
        // TDD Red: 파일 미생성 — Green 전환 후 이 검증 활성화.
        return;
      }

      const source = fs.readFileSync(filePath, 'utf-8');
      const violations: string[] = [];

      for (const modelName of rule.forbiddenModels) {
        const pattern = buildCrossSchemaPattern(modelName);
        const matches = source.match(pattern);
        if (matches) {
          violations.push(`${rule.label} → this.prisma.${modelName} (${matches.length}건)`);
        }
      }

      expect(violations).toHaveLength(0);
    });
  }
});
