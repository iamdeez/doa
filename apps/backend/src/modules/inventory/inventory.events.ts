// inventory.stock-changed 이벤트는 InventoryService.emitStockChanged 에서 직접 emit.
// ProductEventsHandler(product 모듈)가 구독하여 상품 상태 자동 전이 처리 (ADR-004·014).
// 별도 이벤트 핸들러 클래스 불필요 — InventoryService 가 발행 주체.
