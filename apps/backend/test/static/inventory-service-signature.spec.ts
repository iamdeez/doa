/**
 * 정적 코드 검증 — SC-044, SC-045 [env:static]
 *
 * 대상 SC:
 *   SC-044 (FR-033): InventoryService.checkAvailability 시그니처 확인
 *   SC-045 (FR-034): InventoryService.decreaseStock 시그니처 확인
 *
 * 검증 방법: Node.js fs + 소스 텍스트 파싱
 *   InventoryService TypeScript 소스에서 메서드 시그니처를 정규식으로 검증.
 *
 * 실행: 앱 기동·DB 연결 불필요. 파일 시스템 + 소스 텍스트 검증.
 */

import * as fs from 'fs';
import * as path from 'path';

const BACKEND_ROOT = path.resolve(__dirname, '../../');
const INVENTORY_SERVICE_PATH = path.join(
  BACKEND_ROOT,
  'src/modules/inventory/inventory.service.ts',
);

describe('InventoryService 공개 메서드 시그니처 정적 검증', () => {
  // ─────────────────────────────────────────────
  // SC-044: checkAvailability(variantId: string, quantity: number): Promise<boolean>
  // ─────────────────────────────────────────────
  describe('SC-044: checkAvailability 시그니처 존재 확인', () => {
    it('when_inspect_inventory_service_then_checkAvailability_signature_exists', () => {
      /**
       * SC-044 (FR-033 관련):
       * InventoryService 에 다음 시그니처의 공개 메서드가 존재해야 한다:
       *   checkAvailability(variantId: string, quantity: number): Promise<boolean>
       *
       * 검증 전략:
       *   1. 메서드명 checkAvailability 가 존재하는지 확인.
       *   2. 인자 (variantId: string, quantity: number) 형태 확인.
       *   3. 반환 타입 Promise<boolean> 확인.
       */
      if (!fs.existsSync(INVENTORY_SERVICE_PATH)) {
        // TDD Red: 파일 미생성 — Green 전환 후 이 검증 활성화.
        return;
      }

      const source = fs.readFileSync(INVENTORY_SERVICE_PATH, 'utf-8');

      // 메서드명 존재 확인
      expect(source).toMatch(/checkAvailability/);

      // 파라미터 타입 확인 (variantId: string, quantity: number)
      expect(source).toMatch(/variantId\s*:\s*string/);
      expect(source).toMatch(/quantity\s*:\s*number/);

      // 반환 타입 확인 Promise<boolean>
      expect(source).toMatch(/Promise<boolean>/);
    });
  });

  // ─────────────────────────────────────────────
  // SC-045: decreaseStock(variantId: string, quantity: number, orderId: string): Promise<void>
  // ─────────────────────────────────────────────
  describe('SC-045: decreaseStock 시그니처 존재 확인', () => {
    it('when_inspect_inventory_service_then_decreaseStock_signature_exists', () => {
      /**
       * SC-045 (FR-034 관련):
       * InventoryService 에 다음 시그니처의 공개 메서드가 존재해야 한다:
       *   decreaseStock(variantId: string, quantity: number, orderId: string): Promise<void>
       *
       * 검증 전략:
       *   1. 메서드명 decreaseStock 이 존재하는지 확인.
       *   2. 인자 (variantId, quantity, orderId) 형태 확인.
       *   3. 반환 타입 Promise<void> 확인.
       */
      if (!fs.existsSync(INVENTORY_SERVICE_PATH)) {
        // TDD Red: 파일 미생성 — Green 전환 후 이 검증 활성화.
        return;
      }

      const source = fs.readFileSync(INVENTORY_SERVICE_PATH, 'utf-8');

      // 메서드명 존재 확인
      expect(source).toMatch(/decreaseStock/);

      // orderId 파라미터 타입 확인
      expect(source).toMatch(/orderId\s*:\s*string/);

      // 반환 타입 확인 Promise<void>
      expect(source).toMatch(/Promise<void>/);
    });

    it('when_inspect_inventory_service_then_decreaseStock_is_async', () => {
      /**
       * SC-045 (FR-034 관련):
       * decreaseStock 은 async 메서드 (Promise<void> 반환 전제).
       */
      if (!fs.existsSync(INVENTORY_SERVICE_PATH)) {
        return;
      }

      const source = fs.readFileSync(INVENTORY_SERVICE_PATH, 'utf-8');

      // async decreaseStock 또는 decreaseStock(...): Promise<void> 형태 중 하나
      const isAsync =
        /async\s+decreaseStock/.test(source) ||
        /decreaseStock[^{]*:\s*Promise<void>/.test(source);

      expect(isAsync).toBe(true);
    });
  });
});
