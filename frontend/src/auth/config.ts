// Cognito 설정값 (Vite build time에 주입됨)

export const cognitoConfig = {
  region: import.meta.env.VITE_COGNITO_REGION || "ap-northeast-2",
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || "",
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID || "",
  // 예: hash-storage-auth.auth.ap-northeast-2.amazoncognito.com
  domain: import.meta.env.VITE_COGNITO_DOMAIN || "",
  // 예: https://castorfs.org/auth/callback
  redirectUri:
    import.meta.env.VITE_COGNITO_REDIRECT_URI ||
    (typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : ""),
};
