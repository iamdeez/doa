import type { ApiErrorBody } from '@doa/shared-types';
import {
  createAuthFetch,
  type AuthFetchOptions,
  type AuthRequestInit,
} from './auth-fetch';

export type { TokenStore } from './auth-fetch';
/** @deprecated AuthFetchOptions 과 동일. */
export type HttpClientOptions = AuthFetchOptions;

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
 * fetch 기반 HTTP 클라이언트 (legacy 도메인 facade 용).
 * 토큰 주입·401 자동 refresh 는 공유 authFetch 에 위임하고, 본 클래스는
 * 쿼리 직렬화·JSON 본문·표준 에러 변환·204 처리만 담당한다.
 */
export class HttpClient {
  private readonly authFetch: typeof fetch;

  constructor(opts: HttpClientOptions, authFetch?: typeof fetch) {
    this.authFetch = authFetch ?? createAuthFetch(opts);
  }

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

  private withQuery(path: string, query?: RequestOptions['query']): string {
    if (!query) return path;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) params.set(k, String(v));
    }
    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
  }

  private async request<T>(method: Method, path: string, options: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';

    const init: AuthRequestInit = {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
      doaAnonymous: options.anonymous,
    };

    const res = await this.authFetch(this.withQuery(path, options.query), init);

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
}
