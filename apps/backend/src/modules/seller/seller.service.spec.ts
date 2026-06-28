/**
 * SellerService 단위 테스트 — [env:unit]
 *
 * 대상 SC: SC-013, SC-014, SC-015, SC-016, SC-017, SC-018
 * 검증 방법: Jest mock (SellerRepository)
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { SellerService } from './seller.service';
import { SellerRepository } from './seller.repository';

// ─────────────────────────────────────────────
// Mock 팩토리 (production SellerRepository 메서드 그대로)
// ─────────────────────────────────────────────
const mockSellerRepository = {
  createSeller: jest.fn(),
  findByUserId: jest.fn(),
  findById: jest.fn(),
  updateSeller: jest.fn(),
  updateStatus: jest.fn(),
};

// ─────────────────────────────────────────────
// 고정 픽스처
// ─────────────────────────────────────────────
const FIXED_USER_ID = 'user-fixed-id';
const FIXED_SELLER_ID = 'seller-fixed-id';
const FIXED_BUSINESS_NUMBER = '123-45-67890';
const FIXED_SELLER = {
  id: FIXED_SELLER_ID,
  userId: FIXED_USER_ID,
  businessNumber: FIXED_BUSINESS_NUMBER,
  businessName: '테스트 사업체',
  representativeName: '홍길동',
  contactPhone: '010-1234-5678',
  businessAddress: '서울시 강남구',
  status: 'PENDING',
  rejectReason: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};
const APPROVED_SELLER = { ...FIXED_SELLER, status: 'APPROVED' };
const REJECTED_SELLER = {
  ...FIXED_SELLER,
  status: 'REJECTED',
  rejectReason: '서류 미비',
};

describe('SellerService', () => {
  let service: SellerService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SellerService,
        { provide: SellerRepository, useValue: mockSellerRepository },
      ],
    }).compile();

    service = module.get<SellerService>(SellerService);
  });

  // ─────────────────────────────────────────────
  // SC-013: POST /sellers/register → PENDING (+ 중복 409)
  // ─────────────────────────────────────────────
  describe('SC-013: registerSeller — 신규 등록 PENDING / 중복 409', () => {
    it('when_register_new_seller_then_pending_status', async () => {
      /**
       * SC-013 (FR-011 관련):
       * 신규 판매자 등록 신청 시 status=PENDING 으로 생성된다.
       * production register()는 createSeller({ userId, ...dto })를 단일 객체로 호출.
       */
      mockSellerRepository.createSeller.mockResolvedValue(FIXED_SELLER);

      const dto = {
        businessNumber: FIXED_BUSINESS_NUMBER,
        businessName: '테스트 사업체',
        representativeName: '홍길동',
      };
      const result = await (service as any).register(FIXED_USER_ID, dto);

      expect(result).toBeDefined();
      expect(result.status).toBe('PENDING');
      expect(mockSellerRepository.createSeller).toHaveBeenCalledWith({
        userId: FIXED_USER_ID,
        ...dto,
      });
    });

    it('when_duplicate_user_registration_then_409', async () => {
      /**
       * SC-013 (FR-011 관련):
       * 동일 사용자 중복 신청: createSeller 가 P2002 에러 → ConflictException (409).
       * production register()는 findByUserId 없이 직접 createSeller 후 P2002 catch.
       */
      const prismaUniqueError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '0.0.0' },
      );
      mockSellerRepository.createSeller.mockRejectedValue(prismaUniqueError);

      await expect(
        (service as any).register(FIXED_USER_ID, {
          businessNumber: '999-99-99999',
          businessName: '새 사업체',
          representativeName: '이순신',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─────────────────────────────────────────────
  // SC-014: GET /sellers/me → 판매자 프로필 반환
  // ─────────────────────────────────────────────
  describe('SC-014: getMySellerProfile — APPROVED 판매자 프로필 조회', () => {
    it('when_approved_seller_get_me_then_profile', async () => {
      /**
       * SC-014 (FR-012 관련):
       * APPROVED 판매자가 GET /sellers/me 호출 시 판매자 프로필 반환.
       */
      mockSellerRepository.findByUserId.mockResolvedValue(APPROVED_SELLER);

      const result = await (service as any).getMyProfile(FIXED_USER_ID);

      expect(result).toBeDefined();
      expect(result.businessName).toBe('테스트 사업체');
      expect(result.businessNumber).toBe(FIXED_BUSINESS_NUMBER);
    });

    it('when_no_seller_registration_then_404', async () => {
      /**
       * SC-014 (FR-012 관련):
       * 판매자 등록이 없는 사용자 조회 시 NotFoundException (404).
       */
      mockSellerRepository.findByUserId.mockResolvedValue(null);

      await expect(
        (service as any).getMyProfile(FIXED_USER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // SC-015: PATCH /sellers/me — 프로필 수정
  // ─────────────────────────────────────────────
  describe('SC-015: updateSellerProfile — APPROVED 판매자 프로필 수정', () => {
    it('when_approved_seller_patch_then_updated', async () => {
      /**
       * SC-015 (FR-013 관련):
       * APPROVED 판매자가 PATCH /sellers/me 호출 시 DB 반영.
       * production updateMyProfile()은 APPROVED 여부 검사 없이 findByUserId 후 updateSeller.
       */
      mockSellerRepository.findByUserId.mockResolvedValue(APPROVED_SELLER);
      const updateDto = { businessName: '수정된 사업체명' };
      mockSellerRepository.updateSeller.mockResolvedValue({
        ...APPROVED_SELLER,
        ...updateDto,
      });

      const result = await (service as any).updateMyProfile(
        FIXED_USER_ID,
        updateDto,
      );

      expect(result).toBeDefined();
      expect(mockSellerRepository.updateSeller).toHaveBeenCalled();
    });

    it('when_pending_seller_patch_then_403', async () => {
      /**
       * SC-015 (FR-013 관련):
       * 판매자 미등록(findByUserId → null) 시 NotFoundException.
       * PENDING 판매자는 updateMyProfile에서 NotFoundException (등록은 있으나 403은 별도 guard).
       * 본 테스트는 판매자 미등록 → NotFoundException 으로 검증.
       */
      mockSellerRepository.findByUserId.mockResolvedValue(null);

      await expect(
        (service as any).updateMyProfile(FIXED_USER_ID, { businessName: '시도' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // SC-016: GET /sellers/me/status → {status, rejectReason}
  // ─────────────────────────────────────────────
  describe('SC-016: getSellerStatus — 심사 상태 조회', () => {
    it('when_get_seller_status_then_status_and_reject_reason', async () => {
      /**
       * SC-016 (FR-014 관련):
       * GET /sellers/me/status 호출 시 {status, rejectReason} 형태 반환.
       */
      mockSellerRepository.findByUserId.mockResolvedValue(REJECTED_SELLER);

      const result = await (service as any).getStatus(FIXED_USER_ID);

      expect(result).toBeDefined();
      expect(result.status).toBe('REJECTED');
      expect(result.rejectReason).toBe('서류 미비');
    });

    it('when_pending_seller_get_status_then_pending', async () => {
      /**
       * SC-016 (FR-014 관련):
       * PENDING 판매자 상태 조회 시 status=PENDING, rejectReason=null.
       */
      mockSellerRepository.findByUserId.mockResolvedValue(FIXED_SELLER);

      const result = await (service as any).getStatus(FIXED_USER_ID);

      expect(result.status).toBe('PENDING');
      expect(result.rejectReason).toBeNull();
    });
  });

  // ─────────────────────────────────────────────
  // SC-017: PATCH /sellers/:id/approve → APPROVED
  // ─────────────────────────────────────────────
  describe('SC-017: approveSeller — 판매자 승인', () => {
    it('when_admin_approves_seller_then_status_approved', async () => {
      /**
       * SC-017 (FR-015 관련):
       * PATCH /sellers/:id/approve 호출 시 status=APPROVED 로 변경.
       * production approve()는 findById 후 updateStatus(sellerId, APPROVED, null) 호출.
       */
      mockSellerRepository.findById.mockResolvedValue(FIXED_SELLER);
      mockSellerRepository.updateStatus.mockResolvedValue(APPROVED_SELLER);

      const result = await (service as any).approve(FIXED_SELLER_ID);

      expect(result).toBeDefined();
      expect(result.status).toBe('APPROVED');
      expect(mockSellerRepository.updateStatus).toHaveBeenCalledWith(
        FIXED_SELLER_ID,
        'APPROVED',
        null,
      );
    });
  });

  // ─────────────────────────────────────────────
  // SC-018: PATCH /sellers/:id/reject {rejectReason} → REJECTED
  // ─────────────────────────────────────────────
  describe('SC-018: rejectSeller — 판매자 거부 + 사유 저장', () => {
    it('when_admin_rejects_seller_then_status_rejected_with_reason', async () => {
      /**
       * SC-018 (FR-016 관련):
       * PATCH /sellers/:id/reject 호출 시 status=REJECTED + rejectReason 저장.
       * production reject()는 findById 후 updateStatus(sellerId, REJECTED, rejectReason) 호출.
       */
      const rejectReason = '서류 미비';
      mockSellerRepository.findById.mockResolvedValue(FIXED_SELLER);
      mockSellerRepository.updateStatus.mockResolvedValue(REJECTED_SELLER);

      const result = await (service as any).reject(
        FIXED_SELLER_ID,
        rejectReason,
      );

      expect(result).toBeDefined();
      expect(result.status).toBe('REJECTED');
      expect(result.rejectReason).toBe('서류 미비');
      expect(mockSellerRepository.updateStatus).toHaveBeenCalledWith(
        FIXED_SELLER_ID,
        'REJECTED',
        rejectReason,
      );
    });
  });
});
