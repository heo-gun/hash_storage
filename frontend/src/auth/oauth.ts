/**
 * Cognito Hosted UI OAuth 2.0 Authorization Code + PKCE 흐름.
 * 외부 IdP (Google) 로그인에 사용.
 */
import { cognitoConfig } from "./config";
import { StoredTokens } from "./storage";

const PKCE_KEY = "castorfs.auth.pkce_verifier";
const STATE_KEY = "castorfs.auth.oauth_state";

function randomString(len: number): string {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
    .slice(0, len);
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Google IdP를 통한 로그인 시작 — Cognito Hosted UI로 리다이렉트.
 */
export async function startGoogleLogin(): Promise<void> {
  if (!cognitoConfig.domain) {
    throw new Error("VITE_COGNITO_DOMAIN이 설정되지 않았습니다");
  }

  const verifier = randomString(64);
  const challenge = await sha256Base64Url(verifier);
  const state = randomString(32);

  sessionStorage.setItem(PKCE_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: cognitoConfig.clientId,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: cognitoConfig.redirectUri,
    identity_provider: "Google",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });

  window.location.href = `https://${cognitoConfig.domain}/oauth2/authorize?${params}`;
}

/**
 * /auth/callback 페이지에서 호출. authorization code를 토큰으로 교환.
 */
export async function exchangeCodeForTokens(
  code: string,
  receivedState: string
): Promise<StoredTokens> {
  const expectedState = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(PKCE_KEY);

  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(PKCE_KEY);

  if (!expectedState || expectedState !== receivedState) {
    throw new Error("OAuth state mismatch (CSRF 의심)");
  }
  if (!verifier) {
    throw new Error("PKCE verifier가 없습니다");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: cognitoConfig.clientId,
    code,
    redirect_uri: cognitoConfig.redirectUri,
    code_verifier: verifier,
  });

  const res = await fetch(`https://${cognitoConfig.domain}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error(`Token exchange 실패: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    id_token: string;
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    idToken: data.id_token,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

/**
 * Hosted UI 로그인한 사용자의 refresh token으로 새 ID/Access token 발급.
 */
export async function refreshTokensViaOAuth(
  refreshToken: string
): Promise<StoredTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: cognitoConfig.clientId,
    refresh_token: refreshToken,
  });

  const res = await fetch(`https://${cognitoConfig.domain}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) throw new Error(`Refresh 실패: ${res.status}`);

  const data = (await res.json()) as {
    id_token: string;
    access_token: string;
    expires_in: number;
  };

  return {
    idToken: data.id_token,
    accessToken: data.access_token,
    refreshToken, // refresh token rotation 미사용 시 그대로
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

/**
 * Cognito Hosted UI 로그아웃 (전역 세션 종료).
 */
export function hostedUiLogoutUrl(): string {
  const params = new URLSearchParams({
    client_id: cognitoConfig.clientId,
    logout_uri: window.location.origin,
  });
  return `https://${cognitoConfig.domain}/logout?${params}`;
}
