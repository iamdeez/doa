/**
 * CouponService 단위 테스트 — 004-review-coupon [env:unit]
 *
 * 대상 SC:
 *   SC-001 (FR-001) — 어드민 FIXED 쿠폰 생성
 *   SC-002 (FR-001) — 어드민 PERCENTAGE 쿠폰 생성
 *   SC-004 (FR-002) — 판매자 쿠폰 issuerType=SELLER
 *   SC-005 (FR-002) — APPROVED 판매자 아닌 경우 403
 *   SC-006 (FR-003) — 어드민 발급 → UserCoupon status=unused
 *   SC-007 (FR-003) — 발급 한도 초과 → 409
 *   SC-008 (FR-004) — 판매자 자신의 쿠폰으로 발급 → 성공
 *   SC-009 (FR-004) — 판매자 타인 쿠폰 발급 시도 → 403
 *   SC-010 (FR-005) — 내 쿠폰 목록 조회
 *   SC-011 (FR-006) — 판매자 쿠폰 목록 조회
 *   SC-013 (FR-012) — FIXED 쿠폰 할인 계산
 *   SC-014 (FR-012) — PERCENTAGE 쿠폰 할인 계산 (floor + maxDiscount 캡)
 *   SC-015 (FR-011c) — 만료 쿠폰 → 422
 *   SC-016 (FR-011a) — status=used → 422
 *   SC-017 (FR-011b) — 타인 쿠폰 → 403
 *   SC-018 (FR-011d) — minOrderAmount 미달 → 422
 *   SC-020 (FR-013) — 이중사용: markUserCouponUsed count=0 → 409
 *   SC-024 (FR-017) — coupon.used 이벤트 발행 (5개 필드)
 *   SC-051 (NFR-002) — 조건부 UPDATE WHERE status='unused' 호출 확인
 */

import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CouponIssuerType, CouponType, Prisma, UserCouponStatus } from '@prisma/client';
import { CouponService } from './coupon.service';
import { CouponRepository, UserCouponWithCoupon } from './coupon.repository';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { SellerService } from '../seller/seller.service';

// ── Mock Factories ──────────────────────────────────────────────────────────

const mockCouponRepository = {
  createCoupon: jest.fn(),
  findCouponById: jest.fn(),
  incrementIssuedCountConditional: jest.fn(),
  createUserCoupon: jest.fn(),
  findUserCouponWithCoupon: jest.fn(),
  listUserCoupons: jest.fn(),
  listCouponsByIssuer: jest.fn(),
  markUserCouponUsed: jest.fn(),
  restoreUserCouponsByOrder: jest.fn(),
};

const mockSellerService = {
  getApprovedSeller: jest.fn(),
};

const mockPrismaService = {
  runInTransaction: jest.fn().mockImplementation((fn: () => unknown) => fn()),
  onAfterCommit: jest
    .fn()
    .mockImplementation((cb: () => unknown) => Promise.resolve(cb())),
  get tx() {
    return this;
  },
};

const mockEventEmitter = {
  emit: jest.fn(),
};

// ── Fixture Data ────────────────────────────────────────────────────────────

const FIXED_COUPON = {
  id: 'coupon-1',
  issuerType: CouponIssuerType.ADMIN,
  issuerId: 'admin-1',
  type: CouponType.FIXED,
  discountValue: new Prisma.Decimal('5000'),
  maxDiscountAmount: null,
  minOrderAmount: null,
  expiresAt: new Date('2027-01-01'),
  totalQuantity: null,
  issuedCount: 0,
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const PERCENTAGE_COUPON = {
  id: 'coupon-2',
  issuerType: CouponIssuerType.ADMIN,
  issuerId: 'admin-1',
  type: CouponType.PERCENTAGE,
  discountValue: new Prisma.Decimal('20'),
  maxDiscountAmount: new Prisma.Decimal('10000'),
  minOrderAmount: new Prisma.Decimal('30000'),
  expiresAt: new Date('2027-01-01'),
  totalQuantity: null,
  issuedCount: 0,
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const SELLER_COUPON = {
  id: 'coupon-3',
  issuerType: CouponIssuerType.SELLER,
  issuerId: 'seller-id-1',
  type: CouponType.FIXED,
  discountValue: new Prisma.Decimal('3000'),
  maxDiscountAmount: null,
  minOrderAmount: null,
  expiresAt: new Date('2027-01-01'),
  totalQuantity: 2,
  issuedCount: 0,
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const UNUSED_USER_COUPON: UserCouponWithCoupon = {
  id: 'uc-1',
  couponId: 'coupon-1',
  userId: 'user-1',
  status: UserCouponStatus.unused,
  usedOrderId: null,
  createdAt: new Date(),
  coupon: FIXED_COUPON,
};

// ── Test Suite ───────────────────────────────────────────────────────────────

describe('CouponService', () => {
  let service: CouponService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponService,
        { provide: CouponRepository, useValue: mockCouponRepository },
        { provide: SellerService, useValue: mockSellerService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<CouponService>(CouponService);
  });

  // ── 어드민 쿠폰 생성 (SC-001, SC-002) ──────────────────────────────────

  describe('createCoupon — admin', () => {
    it('when_admin_creates_FIXED_coupon_then_repository_createCoupon_called_with_ADMIN', async () => {
      /**
       * SC-001 (FR-001): 어드민이 FIXED 쿠폰 생성 → DB 저장.
       * issuerType=ADMIN, issuerId=adminUserId 로 저장되어야 한다.
       */
      mockCouponRepository.createCoupon.mockResolvedValue(FIXED_COUPON);

      await service.createCoupon('admin-1', {
        type: CouponType.FIXED,
        discountValue: new Prisma.Decimal('5000'),
        expiresAt: new Date('2027-01-01'),
      });

      expect(mockCouponRepository.createCoupon).toHaveBeenCalledWith(
        expect.objectContaining({
          issuerType: CouponIssuerType.ADMIN,
          issuerId: 'admin-1',
          type: CouponType.FIXED,
        }),
      );
    });

    it('when_admin_creates_PERCENTAGE_coupon_then_stored', async () => {
      /**
       * SC-002 (FR-001): 어드민이 PERCENTAGE 쿠폰 생성 → DB 저장.
       */
      mockCouponRepository.createCoupon.mockResolvedValue(PERCENTAGE_COUPON);

      await service.createCoupon('admin-1', {
        type: CouponType.PERCENTAGE,
        discountValue: new Prisma.Decimal('20'),
        maxDiscountAmount: new Prisma.Decimal('10000'),
        minOrderAmount: new Prisma.Decimal('30000'),
        expiresAt: new Date('2027-01-01'),
      });

      expect(mockCouponRepository.createCoupon).toHaveBeenCalledWith(
        expect.objectContaining({
          issuerType: CouponIssuerType.ADMIN,
          type: CouponType.PERCENTAGE,
        }),
      );
    });
  });

  // ── 판매자 쿠폰 생성 (SC-004, SC-005) ──────────────────────────────────

  describe('createSellerCoupon', () => {
    it('when_approved_seller_creates_coupon_then_issuerType_SELLER', async () => {
      /**
       * SC-004 (FR-002): APPROVED 판매자가 쿠폰 생성 시 issuerType=SELLER, issuerId=sellerId.
       */
      mockSellerService.getApprovedSeller.mockResolvedValue({
        id: 'seller-id-1',
        userId: 'seller-user-1',
      });
      mockCouponRepository.createCoupon.mockResolvedValue(SELLER_COUPON);

      await service.createSellerCoupon('seller-user-1', {
        type: CouponType.FIXED,
        discountValue: new Prisma.Decimal('3000'),
        expiresAt: new Date('2027-01-01'),
      });

      expect(mockCouponRepository.createCoupon).toHaveBeenCalledWith(
        expect.objectContaining({
          issuerType: CouponIssuerType.SELLER,
          issuerId: 'seller-id-1',
        }),
      );
    });

    it('when_non_approved_seller_creates_coupon_then_ForbiddenException', async () => {
      /**
       * SC-005 (FR-002): APPROVED 아닌 판매자 → 403.
       * getApprovedSeller 가 ForbiddenException 던지면 전파된다.
       */
      mockSellerService.getApprovedSeller.mockRejectedValue(
        new ForbiddenException('Seller is not approved'),
      );

      await expect(
        service.createSellerCoupon('pending-seller', {
          type: CouponType.FIXED,
          discountValue: new Prisma.Decimal('3000'),
          expiresAt: new Date('2027-01-01'),
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── 어드민 발급 (SC-006, SC-007) ───────────────────────────────────────

  describe('issueByAdmin', () => {
    it('when_admin_issues_coupon_then_UserCoupon_created', async () => {
      /**
       * SC-006 (FR-003): 어드민이 발급 → UserCoupon(status=unused) 생성.
       * incrementIssuedCountConditional 1 + createUserCoupon 호출.
       */
      mockCouponRepository.findCouponById.mockResolvedValue(FIXED_COUPON);
      mockCouponRepository.incrementIssuedCountConditional.mockResolvedValue(1);
      mockCouponRepository.createUserCoupon.mockResolvedValue({
        id: 'uc-new',
        couponId: 'coupon-1',
        userId: 'user-1',
        status: UserCouponStatus.unused,
        usedOrderId: null,
        createdAt: new Date(),
      });
      mockCouponRepository.findUserCouponWithCoupon.mockResolvedValue(UNUSED_USER_COUPON);

      const result = await service.issueByAdmin('admin-1', 'coupon-1', 'user-1');

      expect(mockCouponRepository.incrementIssuedCountConditional).toHaveBeenCalledWith(
        'coupon-1',
      );
      expect(mockCouponRepository.createUserCoupon).toHaveBeenCalledWith({
        couponId: 'coupon-1',
        userId: 'user-1',
      });
      expect(result).toBeDefined();
    });

    it('when_issuedCount_exceeds_totalQuantity_then_ConflictException', async () => {
      /**
       * SC-007 (FR-003): totalQuantity=2 쿠폰에 3번째 발급 시도 → 409.
       * incrementIssuedCountConditional 가 0 반환 시 ConflictException.
       */
      mockCouponRepository.findCouponById.mockResolvedValue({
        ...FIXED_COUPON,
        issuerType: CouponIssuerType.ADMIN,
        issuerId: 'admin-1',
        totalQuantity: 2,
        issuedCount: 2,
      });
      mockCouponRepository.incrementIssuedCountConditional.mockResolvedValue(0);

      await expect(
        service.issueByAdmin('admin-1', 'coupon-1', 'user-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('when_admin_issues_others_coupon_then_ForbiddenException', async () => {
      /**
       * SC-009 관련: 발급자 불일치 → 403.
       */
      mockCouponRepository.findCouponById.mockResolvedValue({
        ...FIXED_COUPON,
        issuerId: 'other-admin',
      });

      await expect(
        service.issueByAdmin('admin-1', 'coupon-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── 판매자 발급 (SC-008, SC-009) ───────────────────────────────────────

  describe('issueBySeller', () => {
    it('when_seller_issues_own_coupon_then_success', async () => {
      /**
       * SC-008 (FR-004): APPROVED 판매자가 자신의 쿠폰으로 발급 → 성공.
       */
      mockSellerService.getApprovedSeller.mockResolvedValue({
        id: 'seller-id-1',
        userId: 'seller-user-1',
      });
      mockCouponRepository.findCouponById.mockResolvedValue(SELLER_COUPON);
      mockCouponRepository.incrementIssuedCountConditional.mockResolvedValue(1);
      mockCouponRepository.createUserCoupon.mockResolvedValue({
        id: 'uc-new',
        couponId: 'coupon-3',
        userId: 'user-1',
        status: UserCouponStatus.unused,
        usedOrderId: null,
        createdAt: new Date(),
      });
      mockCouponRepository.findUserCouponWithCoupon.mockResolvedValue({
        ...UNUSED_USER_COUPON,
        couponId: 'coupon-3',
        coupon: SELLER_COUPON,
      });

      const result = await service.issueBySeller('seller-user-1', 'coupon-3', 'user-1');

      expect(result).toBeDefined();
    });

    it('when_seller_issues_others_coupon_then_ForbiddenException', async () => {
      /**
       * SC-009 (FR-004): 판매자 A가 판매자 B의 쿠폰 발급 시도 → 403.
       */
      mockSellerService.getApprovedSeller.mockResolvedValue({
        id: 'seller-id-1',
        userId: 'seller-user-1',
      });
      mockCouponRepository.findCouponById.mockResolvedValue({
        ...SELLER_COUPON,
        issuerId: 'seller-id-2', // 다른 판매자 쿠폰
      });

      await expect(
        service.issueBySeller('seller-user-1', 'coupon-3', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── 쿠폰 목록 조회 (SC-010, SC-011) ────────────────────────────────────

  describe('listMyCoupons', () => {
    it('when_list_my_coupons_then_returns_own_coupons', async () => {
      /**
       * SC-010 (FR-005): 사용자 자신의 user_coupon 목록 반환.
       */
      const mockList = [UNUSED_USER_COUPON];
      mockCouponRepository.listUserCoupons.mockResolvedValue(mockList);

      const result = await service.listMyCoupons('user-1');

      expect(mockCouponRepository.listUserCoupons).toHaveBeenCalledWith('user-1', undefined);
      expect(result).toEqual(mockList);
    });

    it('when_list_my_coupons_with_status_filter_then_filtered', async () => {
      /**
       * SC-010 status 필터링: unused 상태만 조회.
       */
      mockCouponRepository.listUserCoupons.mockResolvedValue([UNUSED_USER_COUPON]);

      await service.listMyCoupons('user-1', UserCouponStatus.unused);

      expect(mockCouponRepository.listUserCoupons).toHaveBeenCalledWith(
        'user-1',
        UserCouponStatus.unused,
      );
    });
  });

  describe('listSellerCoupons', () => {
    it('when_list_seller_coupons_then_returns_own_coupons_only', async () => {
      /**
       * SC-011 (FR-006): APPROVED 판매자 자신이 생성한 쿠폰 목록만 반환.
       */
      mockSellerService.getApprovedSeller.mockResolvedValue({
        id: 'seller-id-1',
        userId: 'seller-user-1',
      });
      const mockResult = { items: [SELLER_COUPON], nextCursor: null };
      mockCouponRepository.listCouponsByIssuer.mockResolvedValue(mockResult);

      const result = await service.listSellerCoupons('seller-user-1');

      expect(mockCouponRepository.listCouponsByIssuer).toHaveBeenCalledWith(
        'seller-id-1',
        undefined,
        undefined,
      );
      expect(result).toEqual(mockResult);
    });
  });

  // ── 쿠폰 할인 계산·검증 (SC-013, SC-014, SC-015, SC-016, SC-017, SC-018) ─

  describe('validateAndCalculateDiscount', () => {
    // ── Happy Path: FIXED 할인 계산 (SC-013) ──────────────────────────

    it('when_FIXED_coupon_then_discountAmount_equals_discountValue', async () => {
      /**
       * SC-013 (FR-012): FIXED 쿠폰 discountAmount = min(discountValue, totalAmount).
       * totalAmount=10000, discountValue=5000 → discountAmount=5000.
       */
      mockCouponRepository.findUserCouponWithCoupon.mockResolvedValue({
        ...UNUSED_USER_COUPON,
        coupon: {
          ...FIXED_COUPON,
          discountValue: new Prisma.Decimal('5000'),
        },
      });

      const result = await service.validateAndCalculateDiscount(
        'uc-1',
        'user-1',
        new Prisma.Decimal('10000'),
      );

      expect(result.discountAmount.toString()).toBe('5000');
      expect(result.couponId).toBe('coupon-1');
    });

    it('when_FIXED_coupon_exceeds_total_then_capped_to_totalAmount', async () => {
      /**
       * SC-013 Edge: FIXED discountValue > totalAmount → min(discountValue, totalAmount) = totalAmount.
       * totalAmount=3000, discountValue=5000 → discountAmount=3000.
       */
      mockCouponRepository.findUserCouponWithCoupon.mockResolvedValue({
        ...UNUSED_USER_COUPON,
        coupon: {
          ...FIXED_COUPON,
          discountValue: new Prisma.Decimal('5000'),
        },
      });

      const result = await service.validateAndCalculateDiscount(
        'uc-1',
        'user-1',
        new Prisma.Decimal('3000'),
      );

      expect(result.discountAmount.toString()).toBe('3000');
    });

    // ── Happy Path: PERCENTAGE 할인 계산 (SC-014) ─────────────────────

    it('when_PERCENTAGE_coupon_then_floor_of_rate_applied', async () => {
      /**
       * SC-014 (FR-012): PERCENTAGE 쿠폰 discountAmount = floor(total×rate/100), maxDiscount 캡.
       * totalAmount=60000, rate=20%, maxDiscount=10000 → base=12000 → capped=10000.
       */
      mockCouponRepository.findUserCouponWithCoupon.mockResolvedValue({
        ...UNUSED_USER_COUPON,
        coupon: PERCENTAGE_COUPON,
      });

      const result = await service.validateAndCalculateDiscount(
        'uc-1',
        'user-1',
        new Prisma.Decimal('60000'),
      );

      expect(result.discountAmount.toString()).toBe('10000');
    });

    it('when_PERCENTAGE_coupon_below_maxDiscount_then_exact_floored', async () => {
      /**
       * SC-014 Edge: totalAmount=30000, rate=20% → base=6000 < maxDiscount=10000 → discountAmount=6000.
       */
      mockCouponRepository.findUserCouponWithCoupon.mockResolvedValue({
        ...UNUSED_USER_COUPON,
        coupon: PERCENTAGE_COUPON,
      });

      const result = await service.validateAndCalculateDiscount(
        'uc-1',
        'user-1',
        new Prisma.Decimal('30000'),
      );

      expect(result.discountAmount.toString()).toBe('6000');
    });

    it('when_PERCENTAGE_coupon_no_maxDiscount_then_full_rate_applied', async () => {
      /**
       * SC-014 Edge: maxDiscountAmount 없는 경우 상한 없이 rate 계산.
       * totalAmount=50000, rate=20%, no max → discountAmount=10000.
       */
      mockCouponRepository.findUserCouponWithCoupon.mockResolvedValue({
        ...UNUSED_USER_COUPON,
        coupon: {
          ...PERCENTAGE_COUPON,
          maxDiscountAmount: null,
          minOrderAmount: null,
        },
      });

      const result = await service.validateAndCalculateDiscount(
        'uc-1',
        'user-1',
        new Prisma.Decimal('50000'),
      );

      expect(result.discountAmount.toString()).toBe('10000');
    });

    // ── Error: FR-011 검증 순서 (SC-016, SC-017, SC-015, SC-018) ─────

    it('when_status_used_then_UnprocessableEntityException_422', async () => {
      /**
       * SC-016 (FR-011a): status=used → 422 UnprocessableEntityException.
       * FR-011 순서: (a) status 체크 먼저.
       * TDD Red: 현재 구현은 ConflictException(409) 반환 — 수정 필요.
       */
      mockCouponRepository.findUserCouponWithCoupon.mockResolvedValue({
        ...UNUSED_USER_COUPON,
        userId: 'user-1',
        status: UserCouponStatus.used,
      });

      await expect(
        service.validateAndCalculateDiscount('uc-1', 'user-1', new Prisma.Decimal('10000')),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('when_userId_mismatch_then_ForbiddenException_403', async () => {
      /**
       * SC-017 (FR-011b): 타인 쿠폰 → 403 ForbiddenException.
       * FR-011 순서: (b) userId 체크.
       */
      mockCouponRepository.findUserCouponWithCoupon.mockResolvedValue({
        ...UNUSED_USER_COUPON,
        userId: 'other-user',
        status: UserCouponStatus.unused,
      });

      await expect(
        service.validateAndCalculateDiscount('uc-1', 'user-1', new Prisma.Decimal('10000')),
      ).rejects.toThrow(ForbiddenException);
    });

    it('when_status_used_and_userId_mismatch_then_422_status_check_first', async () => {
      /**
       * SC-016 + FR-011 순서 검증: (a) status 체크 먼저 → 422.
       * status=used AND userId mismatch 상황에서 spec 상 422 가 먼저.
       * TDD Red: 현재 구현은 (b) userId 먼저 체크 → 403 반환 — 수정 필요.
       */
      mockCouponRepository.findUserCouponWithCoupon.mockResolvedValue({
        ...UNUSED_USER_COUPON,
        userId: 'other-user', // also mismatches
        status: UserCouponStatus.used, // and status is used
      });

      await expect(
        service.validateAndCalculateDiscount('uc-1', 'user-1', new Prisma.Decimal('10000')),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('when_coupon_expired_then_UnprocessableEntityException_422', async () => {
      /**
       * SC-015 (FR-011c): 만료 쿠폰(expiresAt 경과) → 422.
       */
      mockCouponRepository.findUserCouponWithCoupon.mockResolvedValue({
        ...UNUSED_USER_COUPON,
        coupon: {
          ...FIXED_COUPON,
          expiresAt: new Date('2020-01-01'), // 과거 날짜
        },
      });

      await expect(
        service.validateAndCalculateDiscount('uc-1', 'user-1', new Prisma.Decimal('10000')),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('when_totalAmount_below_minOrderAmount_then_UnprocessableEntityException_422', async () => {
      /**
       * SC-018 (FR-011d): minOrderAmount=30000인 쿠폰을 totalAmount=20000으로 시도 → 422.
       */
      mockCouponRepository.findUserCouponWithCoupon.mockResolvedValue({
        ...UNUSED_USER_COUPON,
        coupon: {
          ...FIXED_COUPON,
          minOrderAmount: new Prisma.Decimal('30000'),
        },
      });

      await expect(
        service.validateAndCalculateDiscount('uc-1', 'user-1', new Prisma.Decimal('20000')),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('when_userCoupon_not_found_then_NotFoundException_404', async () => {
      /**
       * FR-011 전제: userCoupon 미존재 → 404.
       */
      mockCouponRepository.findUserCouponWithCoupon.mockResolvedValue(null);

      await expect(
        service.validateAndCalculateDiscount('uc-not-found', 'user-1', new Prisma.Decimal('10000')),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── 쿠폰 사용 처리 (SC-020, SC-024, SC-051) ───────────────────────────

  describe('markUsed', () => {
    it('when_markUsed_succeeds_then_couponUsed_event_emitted_with_5_fields', async () => {
      /**
       * SC-024 (FR-017): 쿠폰 사용 성공 후 coupon.used 이벤트 발행.
       * SC-051 (NFR-002): 조건부 UPDATE WHERE status='unused' 호출 + 5개 필드 검증.
       * payload: userCouponId·couponId·orderId·userId·discountAmount
       */
      mockCouponRepository.markUserCouponUsed.mockResolvedValue(1);

      await service.markUsed(
        'uc-1',
        'coupon-1',
        'order-1',
        'user-1',
        new Prisma.Decimal('5000'),
      );

      // SC-051: markUserCouponUsed(WHERE status='unused') 호출 확인
      expect(mockCouponRepository.markUserCouponUsed).toHaveBeenCalledWith('uc-1', 'order-1');

      // SC-024: coupon.used 이벤트 5개 필드 확인
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'coupon.used',
        expect.objectContaining({
          userCouponId: 'uc-1',
          couponId: 'coupon-1',
          orderId: 'order-1',
          userId: 'user-1',
          discountAmount: '5000',
        }),
      );
    });

    it('when_markUserCouponUsed_returns_0_then_ConflictException_409', async () => {
      /**
       * SC-020 (FR-013): 동시 이중사용 방지.
       * markUserCouponUsed count=0 → ConflictException(409).
       */
      mockCouponRepository.markUserCouponUsed.mockResolvedValue(0);

      await expect(
        service.markUsed(
          'uc-1',
          'coupon-1',
          'order-1',
          'user-1',
          new Prisma.Decimal('5000'),
        ),
      ).rejects.toThrow(ConflictException);

      // 이중사용 차단 시 이벤트 미발행
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  // ── 주문 취소 시 쿠폰 복원 (SC-023) ────────────────────────────────────

  describe('restoreForOrder', () => {
    it('when_restoreForOrder_called_then_repository_restore_called', async () => {
      /**
       * SC-023 (FR-016): 취소 주문의 쿠폰 복원.
       * restoreUserCouponsByOrder 호출로 status=unused 복원.
       */
      mockCouponRepository.restoreUserCouponsByOrder.mockResolvedValue(1);

      await service.restoreForOrder('order-1');

      expect(mockCouponRepository.restoreUserCouponsByOrder).toHaveBeenCalledWith('order-1');
    });
  });
});
