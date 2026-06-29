// Settlement domain events — in-process via @nestjs/event-emitter

/** Settlement 도메인 이벤트 이름 상수 */
export const SETTLEMENT_EVENTS = {
  CREATED: 'settlement.created',
} as const;

/** settlement.created 페이로드 — 알림(SETTLEMENT_CREATED) 수신자(판매자) 해석에 sellerId 포함 (009) */
export interface SettlementCreatedPayload {
  settlementId: string;
  sellerId: string;
}
