/** 런타임 설정. NEXT_PUBLIC_API_URL 미설정 시 로컬 백엔드(포트 3000) 기본값. */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export const STORAGE_KEYS = {
  accessToken: 'doa.console.accessToken',
  refreshToken: 'doa.console.refreshToken',
} as const;
