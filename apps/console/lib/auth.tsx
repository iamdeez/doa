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

interface AuthState {
  loading: boolean;
  profile: UserProfile | null;
  /** 판매자 프로필 존재 시 승인 상태. 미등록이면 null. */
  sellerStatus: SellerStatus | null;
  isAuthenticated: boolean;
  isSeller: boolean;
  /**
   * 관리자 여부. 백엔드는 토큰 클레임이 아닌 ADMIN_USER_IDS env 로 판별하며,
   * 현재 "내가 관리자인가"를 알려주는 클라이언트 대상 엔드포인트가 없다(문서화된 갭).
   * admin 라우트는 백엔드 AdminGuard 가 최종 강제하므로 UI 는 항상 진입 허용하되
   * 403 을 graceful 하게 처리한다. 추후 GET /auth/me 에 isAdmin 노출 시 대체.
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
      isAdmin: false,
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
