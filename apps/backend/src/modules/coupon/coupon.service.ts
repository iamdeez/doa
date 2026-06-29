import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CouponIssuerType, CouponType, Prisma, UserCouponStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { SellerService } from '../seller/seller.service';
import { CouponRepository, UserCouponWithCoupon } from './coupon.repository';

export interface CouponDiscountResult {
  discountAmount: Prisma.Decimal;
  userCouponId: string;
  couponId: string;
}

@Injectable()
export class CouponService {
  constructor(
    private readonly couponRepository: CouponRepository,
    private readonly sellerService: SellerService,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── 관리자 쿠폰 생성 (FR-001) ──────────────────────────────────────────

  async createCoupon(
    adminUserId: string,
    data: {
      type: CouponType;
      discountValue: Prisma.Decimal;
      maxDiscountAmount?: Prisma.Decimal | null;
      minOrderAmount?: Prisma.Decimal | null;
      expiresAt: Date;
      totalQuantity?: number | null;
      description?: string | null;
    },
  ) {
    this._assertValidDiscount(data);
    return this.couponRepository.createCoupon({
      issuerType: CouponIssuerType.ADMIN,
      issuerId: adminUserId,
      ...data,
    });
  }

  // ── 관리자 발급 (FR-003) ────────────────────────────────────────────────

  async issueByAdmin(adminUserId: string, couponId: string, targetUserId: string) {
    const coupon = await this.couponRepository.findCouponById(couponId);
    if (!coupon) throw new NotFoundException('Coupon not found');
    if (coupon.issuerType !== CouponIssuerType.ADMIN) {
      throw new ForbiddenException('Not an admin coupon');
    }
    if (coupon.issuerId !== adminUserId) {
      throw new ForbiddenException('Not your coupon');
    }
    return this._issueCoupon(couponId, targetUserId);
  }

  // ── 판매자 쿠폰 생성 (FR-002) ──────────────────────────────────────────

  async createSellerCoupon(
    sellerUserId: string,
    data: {
      type: CouponType;
      discountValue: Prisma.Decimal;
      maxDiscountAmount?: Prisma.Decimal | null;
      minOrderAmount?: Prisma.Decimal | null;
      expiresAt: Date;
      totalQuantity?: number | null;
      description?: string | null;
    },
  ) {
    const seller = await this.sellerService.getApprovedSeller(sellerUserId);
    this._assertValidDiscount(data);
    return this.couponRepository.createCoupon({
      issuerType: CouponIssuerType.SELLER,
      issuerId: seller.id,
      ...data,
    });
  }

  // ── 판매자 발급 (FR-004) ────────────────────────────────────────────────

  async issueBySeller(sellerUserId: string, couponId: string, targetUserId: string) {
    const seller = await this.sellerService.getApprovedSeller(sellerUserId);
    const coupon = await this.couponRepository.findCouponById(couponId);
    if (!coupon) throw new NotFoundException('Coupon not found');
    if (coupon.issuerType !== CouponIssuerType.SELLER) {
      throw new ForbiddenException('Not a seller coupon');
    }
    if (coupon.issuerId !== seller.id) {
      throw new ForbiddenException('Not your coupon');
    }
    return this._issueCoupon(couponId, targetUserId);
  }

  // ── 내 쿠폰 목록 (FR-005) ──────────────────────────────────────────────

  async listMyCoupons(userId: string, status?: UserCouponStatus) {
    return this.couponRepository.listUserCoupons(userId, status);
  }

  // ── 판매자 쿠폰 목록 (FR-006) ──────────────────────────────────────────

  async listSellerCoupons(sellerUserId: string, cursor?: string, take?: number) {
    const seller = await this.sellerService.getApprovedSeller(sellerUserId);
    return this.couponRepository.listCouponsByIssuer(seller.id, cursor, take);
  }

  // ── 관리자 쿠폰 목록 (FR-007) ──────────────────────────────────────────

  async listAdminCoupons(adminUserId: string, cursor?: string, take?: number) {
    return this.couponRepository.listCouponsByIssuer(adminUserId, cursor, take);
  }

  // ── 주문 생성 시 쿠폰 검증·할인 계산 (FR-011·FR-012) ─────────────────

  /**
   * userCouponId 가 유효하면 할인 금액을 계산해 반환한다.
   * 트랜잭션 외부(pre-tx)에서 호출 — 검증만 수행, 상태 변경 없음.
   *
   * 실패 조건:
   * - 쿠폰 미존재 또는 소유권 불일치 → 404/403
   * - 이미 사용됨 → 409
   * - 만료됨 → 422
   * - 최소 주문 금액 미충족 → 422
   */
  async validateAndCalculateDiscount(
    userCouponId: string,
    userId: string,
    totalAmount: Prisma.Decimal,
  ): Promise<CouponDiscountResult> {
    const userCoupon = await this.couponRepository.findUserCouponWithCoupon(userCouponId);
    if (!userCoupon) throw new NotFoundException('UserCoupon not found');

    // status 검증 먼저 (SC-016: status=used → 422)
    if (userCoupon.status !== UserCouponStatus.unused) {
      throw new UnprocessableEntityException('Coupon already used or expired');
    }

    // 소유권 검증 (status 이후 — 404/422 공개 후 소유권 불일치 시 403)
    if (userCoupon.userId !== userId) throw new ForbiddenException('Not your coupon');

    const coupon = userCoupon.coupon;
    if (coupon.expiresAt < new Date()) {
      throw new UnprocessableEntityException('Coupon has expired');
    }

    if (coupon.minOrderAmount !== null && totalAmount.lt(coupon.minOrderAmount)) {
      throw new UnprocessableEntityException(
        `Order amount does not meet minimum requirement: ${coupon.minOrderAmount.toString()}`,
      );
    }

    const discountAmount = this._calcDiscount(coupon, totalAmount);

    return { discountAmount, userCouponId, couponId: coupon.id };
  }

  // ── 트랜잭션 내 쿠폰 사용 처리 (FR-013) ───────────────────────────────

  /**
   * 트랜잭션 내부에서 호출.
   * updateMany count === 0 → 이중사용(409, ADR-002).
   * 커밋 후 coupon.used 이벤트 emit (onAfterCommit).
   */
  async markUsed(
    userCouponId: string,
    couponId: string,
    orderId: string,
    userId: string,
    discountAmount: Prisma.Decimal,
  ): Promise<void> {
    const count = await this.couponRepository.markUserCouponUsed(userCouponId, orderId);
    if (count === 0) {
      throw new ConflictException('Coupon already used (concurrent attempt)');
    }

    await this.prisma.onAfterCommit(() => {
      this.eventEmitter.emit('coupon.used', {
        userCouponId,
        couponId,
        orderId,
        userId,
        discountAmount: discountAmount.toString(),
      });
    });
  }

  // ── 주문 취소 시 쿠폰 복원 (FR-016) ───────────────────────────────────

  /**
   * 취소된 orderId 에 연결된 user_coupon 을 unused 로 복원.
   * 트랜잭션 내부에서 호출 (cancel runInTransaction 내부).
   */
  async restoreForOrder(orderId: string): Promise<void> {
    await this.couponRepository.restoreUserCouponsByOrder(orderId);
  }

  // ── private helpers ────────────────────────────────────────────────────

  private async _issueCoupon(couponId: string, userId: string): Promise<UserCouponWithCoupon> {
    // 발급 한도 조건부 increment — 0 반환 시 한도 초과(FR-009, ADR-004)
    const affected = await this.couponRepository.incrementIssuedCountConditional(couponId);
    if (affected === 0) {
      throw new ConflictException('Coupon issuance limit reached');
    }
    const userCoupon = await this.couponRepository.createUserCoupon({ couponId, userId });
    const result = await this.couponRepository.findUserCouponWithCoupon(userCoupon.id);
    return result!;
  }

  /**
   * 쿠폰 생성 입력 검증 (SEC-001 — 음수/범위 위반 할인값 차단).
   * 음수 discountValue 는 할인을 음수로 만들어 주문 총액을 증가시키는 과다청구를 유발하므로
   * 생성 시점에 거부한다(서버 권위 검증, DTO @IsDecimal 만으로는 부호·범위 미보장).
   * - discountValue > 0 (FIXED·PERCENTAGE 공통)
   * - PERCENTAGE: discountValue ≤ 100 (비율 상한)
   * - maxDiscountAmount·minOrderAmount: 음수 불가
   */
  private _assertValidDiscount(data: {
    type: CouponType;
    discountValue: Prisma.Decimal;
    maxDiscountAmount?: Prisma.Decimal | null;
    minOrderAmount?: Prisma.Decimal | null;
  }): void {
    if (data.discountValue.lte(0)) {
      throw new BadRequestException('discountValue must be greater than 0');
    }
    if (data.type === CouponType.PERCENTAGE && data.discountValue.gt(100)) {
      throw new BadRequestException(
        'PERCENTAGE discountValue must be between 1 and 100',
      );
    }
    if (data.maxDiscountAmount != null && data.maxDiscountAmount.lt(0)) {
      throw new BadRequestException('maxDiscountAmount must be non-negative');
    }
    if (data.minOrderAmount != null && data.minOrderAmount.lt(0)) {
      throw new BadRequestException('minOrderAmount must be non-negative');
    }
  }

  /**
   * 쿠폰 유형별 할인 금액 계산 (FR-012, ADR-005).
   * FIXED: min(discountValue, totalAmount)
   * PERCENTAGE: floor(totalAmount * discountValue / 100), max 상한 clamp
   * 결과는 항상 0 이상 totalAmount 이하 — 최종 0 floor 로 음수(과다청구) 방어(SEC-001 심층 방어).
   */
  private _calcDiscount(
    coupon: {
      type: CouponType;
      discountValue: Prisma.Decimal;
      maxDiscountAmount: Prisma.Decimal | null;
    },
    totalAmount: Prisma.Decimal,
  ): Prisma.Decimal {
    const ZERO = new Prisma.Decimal(0);

    if (coupon.type === CouponType.FIXED) {
      return Prisma.Decimal.max(
        ZERO,
        Prisma.Decimal.min(coupon.discountValue, totalAmount),
      );
    }

    // PERCENTAGE: floor(total * rate / 100)
    const base = totalAmount
      .mul(coupon.discountValue)
      .div(new Prisma.Decimal(100))
      .toDecimalPlaces(0, Prisma.Decimal.ROUND_FLOOR);

    const capped =
      coupon.maxDiscountAmount !== null
        ? Prisma.Decimal.min(base, coupon.maxDiscountAmount)
        : base;

    return Prisma.Decimal.max(ZERO, Prisma.Decimal.min(capped, totalAmount));
  }
}
