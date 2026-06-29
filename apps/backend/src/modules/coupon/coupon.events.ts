// Coupon domain events — in-process via @nestjs/event-emitter (FR-015)

export interface CouponUsedPayload {
  userCouponId: string;
  couponId: string;
  orderId: string;
  userId: string;
  discountAmount: string; // Decimal.toString()
}
