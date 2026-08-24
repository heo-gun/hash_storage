/**
 * 이메일/비밀번호 흐름만 다룬다. Hosted UI 경유 Google OAuth는 oauth.ts.
 */
import {
  AuthenticationDetails,
  CognitoRefreshToken,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  CognitoUserSession,
} from "amazon-cognito-identity-js";

import { cognitoConfig } from "./config";
import { StoredTokens } from "./storage";

let _userPool: CognitoUserPool | null = null;

function userPool(): CognitoUserPool {
  if (!_userPool) {
    if (!cognitoConfig.userPoolId || !cognitoConfig.clientId) {
      throw new Error(
        "Cognito is not configured (VITE_COGNITO_USER_POOL_ID, VITE_COGNITO_CLIENT_ID)"
      );
    }
    _userPool = new CognitoUserPool({
      UserPoolId: cognitoConfig.userPoolId,
      ClientId: cognitoConfig.clientId,
    });
  }
  return _userPool;
}

function sessionToTokens(session: CognitoUserSession): StoredTokens {
  const id = session.getIdToken();
  return {
    idToken: id.getJwtToken(),
    accessToken: session.getAccessToken().getJwtToken(),
    refreshToken: session.getRefreshToken().getToken(),
    expiresAt: id.getExpiration() * 1000,
  };
}

export function signUp(
  email: string,
  password: string,
  name: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const attrs = [
      new CognitoUserAttribute({ Name: "email", Value: email }),
      new CognitoUserAttribute({ Name: "name", Value: name }),
    ];
    userPool().signUp(email, password, attrs, [], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function confirmSignUp(email: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool() });
    user.confirmRegistration(code, true, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function resendConfirmationCode(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool() });
    user.resendConfirmationCode((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function signIn(
  email: string,
  password: string
): Promise<StoredTokens> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool() });
    const auth = new AuthenticationDetails({
      Username: email,
      Password: password,
    });
    user.authenticateUser(auth, {
      onSuccess: (session) => resolve(sessionToTokens(session)),
      onFailure: (err) => reject(err),
    });
  });
}

export function signOut(): void {
  const current = userPool().getCurrentUser();
  if (current) current.signOut();
}

/**
 * refresh token으로 새 ID/Access token 발급.
 * 주의: 이 메서드는 cognito-identity-js의 storage(localStorage)에 의존하므로
 *      Google OAuth로 로그인한 경우 동작하지 않을 수 있다.
 *      그 경우 oauth.refreshTokens()를 사용한다.
 */
export function refreshSession(
  email: string,
  refreshToken: string
): Promise<StoredTokens> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool() });
    user.refreshSession(
      new CognitoRefreshToken({ RefreshToken: refreshToken }),
      (err, session) => {
        if (err) reject(err);
        else resolve(sessionToTokens(session));
      }
    );
  });
}
