/** Order 도메인 이벤트 이름 상수 */
export const ORDER_EVENTS = {
  CREATED: 'order.created',
  CANCELLED: 'order.cancelled',
  CONFIRMED: 'order.confirmed',
  COMPLETED: 'order.completed',
} as const;

/** order.created 페이로드 — 알림(ORDER_PLACED) 수신자(구매자) 해석에 userId 포함 (009) */
export interface OrderCreatedPayload {
  orderId: string;
  userId: string;
}
