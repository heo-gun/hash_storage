"""Cognito ID token 검증.

JWKS는 PyJWKClient가 내부적으로 캐싱(기본 1시간). 프로세스 시작 시 1회 인스턴스화.
"""
import logging

import jwt
from jwt import PyJWKClient, PyJWTError

from app.config import (
    COGNITO_CLIENT_ID,
    COGNITO_ISSUER,
    COGNITO_JWKS_URL,
    COGNITO_USER_POOL_ID,
)

logger = logging.getLogger(__name__)


class AuthError(Exception):
    def __init__(self, message: str, status: int = 401):
        super().__init__(message)
        self.message = message
        self.status = status


_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        if not COGNITO_JWKS_URL:
            raise AuthError("Cognito가 구성되지 않음 (COGNITO_USER_POOL_ID 필요)", 500)
        _jwks_client = PyJWKClient(COGNITO_JWKS_URL)
    return _jwks_client


def verify_id_token(token: str) -> dict:
    """Cognito ID token을 JWKS로 검증하고 claims를 반환.

    검증 항목: 서명, 만료, issuer, audience(client_id), token_use=id.
    """
    if not COGNITO_USER_POOL_ID or not COGNITO_CLIENT_ID:
        raise AuthError("Cognito가 구성되지 않음", 500)

    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=COGNITO_CLIENT_ID,
            issuer=COGNITO_ISSUER,
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
    except PyJWTError as e:
        logger.info("JWT 검증 실패: %s", e)
        raise AuthError(f"Invalid token: {e}", 401)

    if claims.get("token_use") != "id":
        raise AuthError("ID token이 필요합니다 (access token 아님)", 401)

    return claims
