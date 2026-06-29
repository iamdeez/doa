/**
 * 플랫폼 수수료율 (10%). Prisma Decimal 문자열로 사용 — 부동소수점 금지 (P-005).
 * commission = totalSales × COMMISSION_RATE, payoutAmount = totalSales - commission.
 */
export const COMMISSION_RATE = '0.1' as const;
