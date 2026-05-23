// 토큰 영속 저장 (localStorage)
// XSS 위험은 있지만 SPA에서 가장 흔한 방식. 향후 httpOnly cookie로 강화 가능.

const KEY = "castorfs.auth.tokens";

export interface StoredTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
}

export const tokenStorage = {
  get(): StoredTokens | null {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredTokens;
    } catch {
      return null;
    }
  },
  set(t: StoredTokens) {
    localStorage.setItem(KEY, JSON.stringify(t));
  },
  clear() {
    localStorage.removeItem(KEY);
  },
};
