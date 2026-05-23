import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

import * as oauth from "../auth/oauth";
import { tokenStorage } from "../auth/storage";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000",
});

// 모든 요청에 Authorization: Bearer <id_token> 자동 첨부
api.interceptors.request.use((config) => {
  const t = tokenStorage.get();
  if (t && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${t.idToken}`;
  }
  return config;
});

// 401 발생 시 refresh token으로 1회 재시도
let refreshing: Promise<void> | null = null;

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retried?: boolean;
    };
    if (!original || error.response?.status !== 401 || original._retried) {
      return Promise.reject(error);
    }
    const stored = tokenStorage.get();
    if (!stored) return Promise.reject(error);

    original._retried = true;
    try {
      if (!refreshing) {
        refreshing = (async () => {
          const next = await oauth.refreshTokensViaOAuth(stored.refreshToken);
          tokenStorage.set(next);
        })();
      }
      await refreshing;
      refreshing = null;

      const fresh = tokenStorage.get();
      if (fresh) {
        original.headers.Authorization = `Bearer ${fresh.idToken}`;
      }
      return api(original);
    } catch (e) {
      refreshing = null;
      tokenStorage.clear();
      // 새로고침 후 로그인 페이지로 가도록 강제
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return Promise.reject(e);
    }
  }
);
