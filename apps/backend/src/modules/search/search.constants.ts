/** 검색 결과 기본 페이지 크기 (006-search) */
export const DEFAULT_SEARCH_SIZE = 20;

/** 검색 결과 최대 페이지 크기 */
export const MAX_SEARCH_SIZE = 100;

/** 정렬 옵션 — latest(최신순, 기본) | price_asc(낮은가격순) | price_desc(높은가격순) */
export const SEARCH_SORTS = ['latest', 'price_asc', 'price_desc'] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];
