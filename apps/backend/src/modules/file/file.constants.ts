// 파일 업로드 정책 상수 (011 — SEC-FIND-006-02)

/** presign 허용 MIME 타입 — 현재 purpose(상품·리뷰·프로필 이미지)는 모두 이미지. */
export const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

/** 업로드 확정(confirm) 시 허용 최대 파일 크기 (10MiB). */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
