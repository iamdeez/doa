// Shipping domain events scaffold (in-process via @nestjs/event-emitter)

/** Shipping 도메인 이벤트 이름 상수 */
export const SHIPPING_EVENTS = {
  SHIPPED: 'shipping.shipped',
  DELIVERED: 'shipping.delivered',
} as const;
