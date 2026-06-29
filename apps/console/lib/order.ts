import type { OrderStatus, ShipmentStatus } from '@doa/shared-types';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'dark';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: '결제대기',
  confirmed: '결제완료',
  preparing: '상품준비',
  shipped: '배송중',
  delivered: '배송완료',
  completed: '구매확정',
  cancelled: '취소',
};

export const ORDER_STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  pending: 'neutral',
  confirmed: 'info',
  preparing: 'warning',
  shipped: 'info',
  delivered: 'success',
  completed: 'success',
  cancelled: 'danger',
};

export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  preparing: '준비',
  shipped: '발송',
  in_transit: '배송중',
  delivered: '배송완료',
};

/** Decimal 문자열(부동소수점 금지)을 원화 표기로 포맷. */
export function formatKRW(amount: string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${amount}원`;
  return `${n.toLocaleString('ko-KR')}원`;
}
