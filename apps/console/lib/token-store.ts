import type { AuthTokens } from '@doa/shared-types';
import type { TokenStore } from '@doa/api-client';
import { STORAGE_KEYS } from './config';

/**
 * localStorage 기반 TokenStore. 내부 운영 대시보드(seller/admin) 특성상 허용.
 * SSR(window 부재)에서는 모든 조회가 null 을 반환한다.
 *
 * NOTE: crypto.randomUUID / crypto.subtle 등 Secure Context 한정 API 미사용
 * (HTTP + 비localhost 배포 환경에서 TypeError 회피 — typescript 규칙).
 */
export const browserTokenStore: TokenStore = {
  getAccessToken() {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(STORAGE_KEYS.accessToken);
  },
  getRefreshToken() {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(STORAGE_KEYS.refreshToken);
  },
  setTokens(tokens: AuthTokens) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.accessToken, tokens.accessToken);
    if (tokens.refreshToken) {
      window.localStorage.setItem(STORAGE_KEYS.refreshToken, tokens.refreshToken);
    }
  },
  clear() {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(STORAGE_KEYS.accessToken);
    window.localStorage.removeItem(STORAGE_KEYS.refreshToken);
  },
};
