/**
 * 파일 업로드 정책 상수.
 * 백엔드 file.constants.ts 와 동일 값 — 매직 넘버 방지.
 */

/** presign 허용 이미지 MIME 타입 목록. */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

/** 업로드 허용 최대 파일 크기 (10 MiB). */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
