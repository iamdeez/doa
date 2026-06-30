'use client';

import type { SellerStatus, UserProfile } from '@doa/shared-types';
import { ApiError } from '@doa/api-client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from './api';
import { browserTokenStore } from './token-store';
import { COOKIE_KEYS } from './config';

interface AuthState {
  loading: boolean;
  profile: UserProfile | null;
  /** 판매자 프로필 존재 시 승인 상태. 미등록이면 null. */
  sellerStatus: SellerStatus | null;
  isAuthenticated: boolean;
  isSeller: boolean;
  /**
   * 관리자 여부. GET /auth/me 응답의 isAdmin 필드(FR-001) 에서 채움.
   * 백엔드 ADMIN_USER_IDS env 기반으로 판별한다.
   * 쿠키 미러링(ADR-003) — hydrate 시 doa_console_admin=true/false 를 기록하여
   * Next.js middleware 가 /admin/* 라우트를 UX 수준으로 보호한다.
   * 실제 인가 강제는 백엔드 AdminGuard 가 담당(L2).
   */
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** 프로필·판매자 상태를 백엔드에서 다시 로드 (판매자 등록 직후 등). */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function loadSellerStatus(): Promise<SellerStatus | null> {
  try {
    const res = await api.seller.status();
    return res.status;
  } catch (err) {
    // 미등록 판매자 → 403/404. 인증 자체 실패가 아니면 "판매자 아님"으로 간주.
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
      return null;
    }
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sellerStatus, setSellerStatus] = useState<SellerStatus | null>(null);

  const hydrate = useCallback(async () => {
    if (!browserTokenStore.getAccessToken()) {
      setProfile(null);
      setSellerStatus(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.auth.me();
      setProfile(me);
      setSellerStatus(await loadSellerStatus());
      // 쿠키 미러링 (ADR-003): middleware 라우트 가드가 읽을 수 있도록 비-HttpOnly 쿠키 기록.
      document.cookie = `${COOKIE_KEYS.auth}=1; Path=/; SameSite=Lax`;
      document.cookie = `${COOKIE_KEYS.admin}=${me.isAdmin ? 'true' : 'false'}; Path=/; SameSite=Lax`;
    } catch {
      setProfile(null);
      setSellerStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const login = useCallback(
    async (email: string, password: string) => {
      const tokens = await api.auth.login({ email, password });
      browserTokenStore.setTokens(tokens);
      setLoading(true);
      await hydrate();
    },
    [hydrate],
  );

  const logout = useCallback(async () => {
    const refreshToken = browserTokenStore.getRefreshToken();
    if (refreshToken) {
      await api.auth.logout(refreshToken).catch(() => undefined);
    }
    browserTokenStore.clear();
    // 쿠키 미러링 제거 (ADR-003): Max-Age=0 으로 즉시 만료.
    document.cookie = `${COOKIE_KEYS.auth}=; Path=/; Max-Age=0`;
    document.cookie = `${COOKIE_KEYS.admin}=; Path=/; Max-Age=0`;
    setProfile(null);
    setSellerStatus(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      profile,
      sellerStatus,
      isAuthenticated: profile !== null,
      isSeller: sellerStatus !== null,
      isAdmin: profile?.isAdmin ?? false,
      login,
      logout,
      refresh: hydrate,
    }),
    [loading, profile, sellerStatus, login, logout, hydrate],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 는 AuthProvider 내부에서만 사용할 수 있습니다.');
  return ctx;
}
