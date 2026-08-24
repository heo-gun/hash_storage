import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { api } from "../services/api";
import * as cognito from "./cognito";
import * as oauth from "./oauth";
import { StoredTokens, tokenStorage } from "./storage";

export interface MeProfile {
  user_id: string;
  email: string;
  display_name: string | null;
  quota_bytes: number;
  used_bytes: number;
  is_admin: boolean;
}

interface AuthState {
  user: MeProfile | null;
  tokens: StoredTokens | null;
  loading: boolean; // 부팅 시 세션 복구 중
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => void;
  setSession: (t: StoredTokens) => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<StoredTokens | null>(null);
  const [user, setUser] = useState<MeProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async (idToken: string) => {
    const res = await api.get<MeProfile>("/auth/me", {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    return res.data;
  }, []);

  const setSession = useCallback(
    async (t: StoredTokens) => {
      tokenStorage.set(t);
      setTokens(t);
      const me = await fetchMe(t.idToken);
      setUser(me);
    },
    [fetchMe]
  );

  const signOut = useCallback(() => {
    cognito.signOut();
    tokenStorage.clear();
    setTokens(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const cur = tokenStorage.get();
    if (!cur) throw new Error("No stored session");
    // Hosted UI 경로 우선 (Google) — Cognito SDK도 같은 endpoint 쓸 수 있음
    const next = await oauth.refreshTokensViaOAuth(cur.refreshToken);
    await setSession(next);
  }, [setSession]);

  // 부팅: 저장된 토큰이 있으면 복구
  useEffect(() => {
    (async () => {
      const stored = tokenStorage.get();
      if (!stored) {
        setLoading(false);
        return;
      }
      try {
        if (stored.expiresAt < Date.now() + 60_000) {
          // 만료 임박 → 갱신
          const next = await oauth.refreshTokensViaOAuth(stored.refreshToken);
          await setSession(next);
        } else {
          setTokens(stored);
          const me = await fetchMe(stored.idToken);
          setUser(me);
        }
      } catch (e) {
        console.warn("Could not restore session:", e);
        tokenStorage.clear();
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchMe, setSession]);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const t = await cognito.signIn(email, password);
      await setSession(t);
    },
    [setSession]
  );

  const signInWithGoogle = useCallback(async () => {
    await oauth.startGoogleLogin();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      tokens,
      loading,
      signInWithPassword,
      signInWithGoogle,
      signOut,
      setSession,
      refresh,
    }),
    [
      user,
      tokens,
      loading,
      signInWithPassword,
      signInWithGoogle,
      signOut,
      setSession,
      refresh,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
