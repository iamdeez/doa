/** pg-boss 큐·잡 이름 상수 */
export const OUTBOX_QUEUE = 'payment-outbox-relay' as const;
export const AUTO_CONFIRM_QUEUE = 'order-auto-confirm' as const;

/** 자동확정: 매일 새벽 2시 실행 (cron — pg-boss schedule 형식) */
export const AUTO_CONFIRM_CRON = '0 2 * * *' as const;

/** OutboxRelay: pg-boss 폴링 간격(ms) — work 핸들러가 지속 폴링하므로 불필요하지만 schedule fallback용 */
export const OUTBOX_POLL_INTERVAL_MS = 5000 as const;
