import type { ApiErrorBody, AuthTokens } from '@doa/shared-types';

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

export interface HttpClientOptions {
  /** 백엔드 베이스 URL. 예: http://localhost:3000 (글로벌 프리픽스 없음). */
  baseUrl: string;
  tokens: TokenStore;
  /** 401 → refresh → 원요청 재시도. 기본 true. */
  autoRefresh?: boolean;
  /** 인증 만료(refresh 실패) 시 호출 — 로그인 화면 전환 등. */
  onAuthExpired?: () => void;
}

/** 백엔드 표준 에러 응답을 감싼 예외. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody | null,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Authorization 헤더 생략 (login/register/refresh). */
  anonymous?: boolean;
  signal?: AbortSignal;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/**
 * fetch 기반 HTTP 클라이언트. 토큰 주입·401 자동 refresh·표준 에러 변환을 담당한다.
 * 동시 401 다발 시 refresh 가 한 번만 수행되도록 in-flight promise 를 공유한다.
 */
export class HttpClient {
  private refreshing: Promise<boolean> | null = null;

  constructor(private readonly opts: HttpClientOptions) {}

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, options);
  }
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, { ...options, body });
  }
  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, { ...options, body });
  }
  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, options);
  }

  private buildUrl(path: string, query?: RequestOptions['query']): string {
    const url = new URL(path.replace(/^\//, ''), this.opts.baseUrl.replace(/\/?$/, '/'));
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  private async request<T>(
    method: Method,
    path: string,
    options: RequestOptions = {},
    isRetry = false,
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (!options.anonymous) {
      const token = this.opts.tokens.getAccessToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(this.buildUrl(path, options.query), {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });

    if (res.status === 401 && !options.anonymous && this.opts.autoRefresh !== false && !isRetry) {
      const ok = await this.ensureRefreshed();
      if (ok) return this.request<T>(method, path, options, true);
      this.opts.onAuthExpired?.();
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
      const msg = body
        ? Array.isArray(body.message)
          ? body.message.join(', ')
          : body.message
        : `HTTP ${res.status}`;
      throw new ApiError(res.status, body, msg);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  /** 동시 다발 401 에서도 refresh 1회만 실행. */
  private ensureRefreshed(): Promise<boolean> {
    if (!this.refreshing) {
      this.refreshing = this.doRefresh().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  private async doRefresh(): Promise<boolean> {
    const refreshToken = this.opts.tokens.getRefreshToken();
    if (!refreshToken) return false;
    try {
      const res = await fetch(this.buildUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        this.opts.tokens.clear();
        return false;
      }
      const tokens = (await res.json()) as AuthTokens;
      this.opts.tokens.setTokens({ refreshToken, ...tokens });
      return true;
    } catch {
      this.opts.tokens.clear();
      return false;
    }
  }
}
