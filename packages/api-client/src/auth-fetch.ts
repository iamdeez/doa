import type { AuthTokens } from '@doa/shared-types';

/**
 * 토큰 저장/조회를 호출 측(console)에 위임하기 위한 인터페이스.
 * SSR/CSR·localStorage·메모리 등 저장 전략을 클라이언트가 주입한다.
 */
export interface TokenStore {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  setTokens(tokens: AuthTokens): void;
  clear(): void;
}

export interface AuthFetchOptions {
  /** 백엔드 베이스 URL. 예: http://localhost:3000 (글로벌 프리픽스 없음). */
  baseUrl: string;
  tokens: TokenStore;
  /** 401 → refresh → 원요청 재시도. 기본 true. */
  autoRefresh?: boolean;
  /** 인증 만료(refresh 실패) 시 호출 — 로그인 화면 전환 등. */
  onAuthExpired?: () => void;
}

/** 인증 헤더 주입·401 자동 refresh 를 건너뛰려면 RequestInit 에 이 플래그를 설정한다. */
export interface AuthRequestInit extends RequestInit {
  /** login/register/refresh 등 익명 요청 — 토큰 주입·refresh 재시도 생략. */
  doaAnonymous?: boolean;
}

/**
 * 토큰 주입 + 401 자동 refresh(원요청 재시도)를 담당하는 fetch 래퍼 팩토리.
 * legacy HttpClient 와 openapi-fetch 타입드 클라이언트가 동일 인스턴스를 공유하여
 * refresh 가 앱 전역에서 일관되게(in-flight 1회) 동작한다.
 */
export function createAuthFetch(opts: AuthFetchOptions): typeof fetch {
  let refreshing: Promise<boolean> | null = null;

  const buildUrl = (input: RequestInfo | URL): string => {
    const raw = typeof input === 'string' ? input : input.toString();
    if (/^https?:\/\//.test(raw)) return raw;
    return new URL(raw.replace(/^\//, ''), opts.baseUrl.replace(/\/?$/, '/')).toString();
  };

  const doRefresh = async (): Promise<boolean> => {
    const refreshToken = opts.tokens.getRefreshToken();
    if (!refreshToken) return false;
    try {
      const res = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        opts.tokens.clear();
        return false;
      }
      const tokens = (await res.json()) as AuthTokens;
      opts.tokens.setTokens({ refreshToken, ...tokens });
      return true;
    } catch {
      opts.tokens.clear();
      return false;
    }
  };

  const ensureRefreshed = (): Promise<boolean> => {
    refreshing ??= doRefresh().finally(() => {
      refreshing = null;
    });
    return refreshing;
  };

  const authFetch = async (
    input: RequestInfo | URL,
    init?: AuthRequestInit,
    isRetry = false,
  ): Promise<Response> => {
    const { doaAnonymous, headers, ...rest } = init ?? {};
    const h = new Headers(headers);
    if (!h.has('Accept')) h.set('Accept', 'application/json');
    if (!doaAnonymous) {
      const token = opts.tokens.getAccessToken();
      if (token) h.set('Authorization', `Bearer ${token}`);
    }

    const res = await fetch(buildUrl(input), { ...rest, headers: h });

    if (res.status === 401 && !doaAnonymous && opts.autoRefresh !== false && !isRetry) {
      const ok = await ensureRefreshed();
      if (ok) return authFetch(input, init, true);
      opts.onAuthExpired?.();
    }
    return res;
  };

  return ((input: RequestInfo | URL, init?: RequestInit) =>
    authFetch(input, init as AuthRequestInit)) as typeof fetch;
}
