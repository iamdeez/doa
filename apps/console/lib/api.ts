import { createApiClient } from '@doa/api-client';
import { API_BASE_URL } from './config';
import { browserTokenStore } from './token-store';

/**
 * 브라우저 전역 API 클라이언트 인스턴스.
 * refresh 실패(인증 만료) 시 로그인 화면으로 강제 전환한다.
 */
export const api = createApiClient({
  baseUrl: API_BASE_URL,
  tokens: browserTokenStore,
  onAuthExpired: () => {
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  },
});
