/**
 * CartService 단위 테스트 — [env:unit]
 *
 * 대상 SC: SC-001, SC-002, SC-003, SC-004, SC-005, SC-006, SC-008
 * SC-007(비인증 401)은 test/static/auth-required-guards.spec.ts 정적 검증 (JwtAuthGuard)
 * 검증 방법: Jest mock (CartRepository, ProductService, PrismaService)
 * TDD Red: 구현 미완성 상태에서 작성된 테스트. import error 허용.
 *
 * Canonical 심볼 (tasks.md Test Authoring Contract):
 *   CartService.addItem(userId, {variantId, quantity})
 *   CartService.updateQuantity(userId, variantId, quantity)
 *   CartService.removeItem(userId, variantId)
 *   CartService.getCart(userId)
 *   CartService.removeItems(userId, variantIds: string[])
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CartService } from './cart.service';
import { CartRepository } from './cart.repository';
import { ProductService } from '../product/product.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

// ─────────────────────────────────────────────
// Mock 팩토리 (production Repository/Service 메서드명 그대로)
// ─────────────────────────────────────────────
const mockCartRepository = {
  findByUser: jest.fn(),
  upsertItems: jest.fn(),
};

const mockProductService = {
  getVariantSnapshot: jest.fn(),
};

const mockPrismaService = {
  runInTransaction: jest.fn().mockImplementation((fn: () => unknown) => fn()),
  onAfterCommit: jest.fn().mockImplementation((cb: () => unknown) => Promise.resolve(cb())),
  get tx() { return this; },
};

// ─────────────────────────────────────────────
// 고정 픽스처
// ─────────────────────────────────────────────
const FIXED_USER_A = 'user-id-a';
const FIXED_USER_B = 'user-id-b';
const FIXED_VARIANT_ID = 'variant-id-001';
const FIXED_VARIANT_ID_2 = 'variant-id-002';

const FIXED_VARIANT_SNAPSHOT = {
  variantId: FIXED_VARIANT_ID,
  productId: 'product-id-001',
  sellerId: 'seller-id-001',
  unitPrice: '15000',
  optionName: '색상',
  optionValue: '블랙',
  productTitle: '테스트 상품',
  sku: 'SKU-001',
};

const FIXED_CART_ITEM = {
  variantId: FIXED_VARIANT_ID,
  productId: 'product-id-001',
  sellerId: 'seller-id-001',
  quantity: 2,
  unitPrice: '15000',
  optionName: '색상',
  optionValue: '블랙',
  productTitle: '테스트 상품',
  sku: 'SKU-001',
};

describe('CartService', () => {
  let service: CartService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: CartRepository, useValue: mockCartRepository },
        { provide: ProductService, useValue: mockProductService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
  });

  // ─────────────────────────────────────────────
  // SC-001: 장바구니 아이템 추가 — addItem
  // ─────────────────────────────────────────────
  describe('SC-001: addItem — 장바구니 아이템 추가', () => {
    it('when_add_item_then_item_added', async () => {
      /**
       * SC-001 (FR-001 관련):
       * 인증된 고객이 POST /cart/items {variantId, quantity:2} 호출 시
       * 아이템이 장바구니에 추가된다.
       * production addItem(userId, {variantId, quantity}):
       *   getVariantSnapshot → 기존 cart findByUser → upsertItems (신규 항목)
       */
      mockProductService.getVariantSnapshot.mockResolvedValue(FIXED_VARIANT_SNAPSHOT);
      mockCartRepository.findByUser.mockResolvedValue(null); // 빈 장바구니
      mockCartRepository.upsertItems.mockResolvedValue({
        userId: FIXED_USER_A,
        items: [{ ...FIXED_CART_ITEM, quantity: 2 }],
      });

      await service.addItem(FIXED_USER_A, { variantId: FIXED_VARIANT_ID, quantity: 2 });

      expect(mockProductService.getVariantSnapshot).toHaveBeenCalledWith(FIXED_VARIANT_ID);
      expect(mockCartRepository.upsertItems).toHaveBeenCalledWith(
        FIXED_USER_A,
        expect.arrayContaining([
          expect.objectContaining({ variantId: FIXED_VARIANT_ID, quantity: 2 }),
        ]),
      );
    });
  });

  // ─────────────────────────────────────────────
  // SC-002: 동일 variantId 추가 → 수량 합산
  // ─────────────────────────────────────────────
  describe('SC-002: addItem (same variantId) — 수량 합산', () => {
    it('when_same_variant_then_quantity_summed', async () => {
      /**
       * SC-002 (FR-001 관련):
       * 동일 variantId로 quantity:3 재호출 시 기존 2 + 3 = 5로 합산.
       * production: findByUser → 기존 items에서 동일 variantId 찾아 수량 합산 → upsertItems
       */
      mockProductService.getVariantSnapshot.mockResolvedValue(FIXED_VARIANT_SNAPSHOT);
      // 기존 카트에 quantity=2 아이템 존재
      mockCartRepository.findByUser.mockResolvedValue({
        userId: FIXED_USER_A,
        items: [{ ...FIXED_CART_ITEM, quantity: 2 }],
      });
      mockCartRepository.upsertItems.mockResolvedValue({
        userId: FIXED_USER_A,
        items: [{ ...FIXED_CART_ITEM, quantity: 5 }],
      });

      await service.addItem(FIXED_USER_A, { variantId: FIXED_VARIANT_ID, quantity: 3 });

      // 합산된 수량(5)으로 upsertItems 호출되어야 함
      expect(mockCartRepository.upsertItems).toHaveBeenCalledWith(
        FIXED_USER_A,
        expect.arrayContaining([
          expect.objectContaining({ variantId: FIXED_VARIANT_ID, quantity: 5 }),
        ]),
      );
    });
  });

  // ─────────────────────────────────────────────
  // SC-003: PATCH 수량 변경 → 갱신
  // ─────────────────────────────────────────────
  describe('SC-003: updateQuantity — 수량 변경', () => {
    it('when_update_qty_then_updated', async () => {
      /**
       * SC-003 (FR-002 관련):
       * PATCH /cart/items/:variantId {quantity:5} 호출 시 수량이 5로 갱신.
       * production: updateQuantity(userId, variantId, 5) → findByUser → 해당 item 수량 5로 수정 → upsertItems
       */
      mockCartRepository.findByUser.mockResolvedValue({
        userId: FIXED_USER_A,
        items: [{ ...FIXED_CART_ITEM, quantity: 2 }],
      });
      mockCartRepository.upsertItems.mockResolvedValue({
        userId: FIXED_USER_A,
        items: [{ ...FIXED_CART_ITEM, quantity: 5 }],
      });

      await service.updateQuantity(FIXED_USER_A, FIXED_VARIANT_ID, 5);

      expect(mockCartRepository.upsertItems).toHaveBeenCalledWith(
        FIXED_USER_A,
        expect.arrayContaining([
          expect.objectContaining({ variantId: FIXED_VARIANT_ID, quantity: 5 }),
        ]),
      );
    });
  });

  // ─────────────────────────────────────────────
  // SC-004: PATCH 수량 0 → 아이템 제거
  // ─────────────────────────────────────────────
  describe('SC-004: updateQuantity (0) — 아이템 제거', () => {
    it('when_qty_zero_then_item_removed', async () => {
      /**
       * SC-004 (FR-002 관련):
       * PATCH /cart/items/:variantId {quantity:0} 호출 시 해당 아이템이 제거됨.
       * production: updateQuantity(userId, variantId, 0) → findByUser → 해당 variantId 필터 제외 → upsertItems
       */
      mockCartRepository.findByUser.mockResolvedValue({
        userId: FIXED_USER_A,
        items: [
          { ...FIXED_CART_ITEM, quantity: 2 },
          { variantId: FIXED_VARIANT_ID_2, quantity: 1, productId: 'p2', sellerId: 's2', unitPrice: '5000', optionName: '', optionValue: '', productTitle: '다른 상품', sku: 'SKU-002' },
        ],
      });
      mockCartRepository.upsertItems.mockResolvedValue({
        userId: FIXED_USER_A,
        items: [{ variantId: FIXED_VARIANT_ID_2, quantity: 1 }],
      });

      await service.updateQuantity(FIXED_USER_A, FIXED_VARIANT_ID, 0);

      // variantId 아이템이 제외된 목록으로 upsertItems 호출
      const callArgs = mockCartRepository.upsertItems.mock.calls[0];
      const updatedItems = callArgs[1] as Array<{ variantId: string }>;
      expect(updatedItems.some((i) => i.variantId === FIXED_VARIANT_ID)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────
  // SC-005: DELETE 아이템 제거
  // ─────────────────────────────────────────────
  describe('SC-005: removeItem — 아이템 제거', () => {
    it('when_delete_then_removed', async () => {
      /**
       * SC-005 (FR-003 관련):
       * DELETE /cart/items/:variantId 호출 시 해당 아이템이 제거됨(204).
       * production: removeItem(userId, variantId) → findByUser → 필터 제외 → upsertItems
       */
      mockCartRepository.findByUser.mockResolvedValue({
        userId: FIXED_USER_A,
        items: [{ ...FIXED_CART_ITEM, quantity: 2 }],
      });
      mockCartRepository.upsertItems.mockResolvedValue({
        userId: FIXED_USER_A,
        items: [],
      });

      await service.removeItem(FIXED_USER_A, FIXED_VARIANT_ID);

      expect(mockCartRepository.upsertItems).toHaveBeenCalledWith(
        FIXED_USER_A,
        expect.not.arrayContaining([
          expect.objectContaining({ variantId: FIXED_VARIANT_ID }),
        ]),
      );
    });
  });

  // ─────────────────────────────────────────────
  // SC-006: GET /cart → 목록 / 빈 배열
  // ─────────────────────────────────────────────
  describe('SC-006: getCart — 장바구니 조회', () => {
    it('when_get_then_items_list', async () => {
      /**
       * SC-006 (FR-004 관련):
       * GET /cart 호출 시 현재 장바구니 아이템 목록이 반환됨.
       * production: getCart(userId) → findByUser → cart.items 배열 반환
       */
      const expectedItems = [{ ...FIXED_CART_ITEM, quantity: 2 }];
      mockCartRepository.findByUser.mockResolvedValue({
        userId: FIXED_USER_A,
        items: expectedItems,
      });

      const result = await service.getCart(FIXED_USER_A);

      expect(mockCartRepository.findByUser).toHaveBeenCalledWith(FIXED_USER_A);
      expect(result).toEqual(expect.objectContaining({ items: expectedItems }));
    });

    it('when_empty_cart_then_empty_array', async () => {
      /**
       * SC-006 (FR-004 관련) Edge:
       * 장바구니가 비어 있으면 items=[] 반환.
       */
      mockCartRepository.findByUser.mockResolvedValue(null); // 카트 없음

      const result = await service.getCart(FIXED_USER_A);

      // 빈 배열 또는 {items:[]} 반환
      if (Array.isArray(result)) {
        expect(result).toHaveLength(0);
      } else {
        expect(result).toEqual(expect.objectContaining({ items: [] }));
      }
    });
  });

  // ─────────────────────────────────────────────
  // SC-008: 두 사용자 독립 장바구니
  // ─────────────────────────────────────────────
  describe('SC-008: addItem — 사용자 격리', () => {
    it('when_two_users_then_isolated', async () => {
      /**
       * SC-008 (FR-005 관련):
       * 사용자 A와 B가 각자 addItem 호출 시 서로의 장바구니에 영향 없음.
       * production: userId 키 기준으로 각 cart record 독립 관리
       */
      mockProductService.getVariantSnapshot.mockResolvedValue(FIXED_VARIANT_SNAPSHOT);
      mockCartRepository.findByUser.mockResolvedValue(null);
      mockCartRepository.upsertItems.mockResolvedValue({ userId: FIXED_USER_A, items: [] });

      // User A 추가
      await service.addItem(FIXED_USER_A, { variantId: FIXED_VARIANT_ID, quantity: 1 });
      // User B 추가
      await service.addItem(FIXED_USER_B, { variantId: FIXED_VARIANT_ID, quantity: 3 });

      const calls = mockCartRepository.upsertItems.mock.calls;
      expect(calls[0][0]).toBe(FIXED_USER_A);
      expect(calls[1][0]).toBe(FIXED_USER_B);

      // User A 호출에 User B의 데이터가 섞이지 않음
      const userACall = calls.find((c) => c[0] === FIXED_USER_A);
      const userBCall = calls.find((c) => c[0] === FIXED_USER_B);
      expect(userACall).toBeDefined();
      expect(userBCall).toBeDefined();
      // 각각 독립 호출 확인
      expect(userACall![0]).not.toBe(FIXED_USER_B);
      expect(userBCall![0]).not.toBe(FIXED_USER_A);
    });
  });
});
