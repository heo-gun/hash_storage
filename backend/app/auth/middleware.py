"""@require_auth 데코레이터.

요청에서 Authorization: Bearer <id_token>을 추출 → Cognito 검증 →
users 테이블 lazy upsert → flask.g.current_user에 dict 주입.
"""
from contextlib import closing
from functools import wraps

from flask import g, jsonify, request

from app.auth.cognito import AuthError, verify_id_token
from app.config import AUTH_DEV_BYPASS
from app.db import get_db_connection
from app.services.user_service import upsert_user_from_claims


def _extract_token() -> str:
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise AuthError("Authorization 헤더 필요 (Bearer)", 401)
    return header[len("Bearer ") :].strip()


def _resolve_user() -> dict:
    if AUTH_DEV_BYPASS:
        sub = request.headers.get("X-Debug-User-Sub")
        email = request.headers.get("X-Debug-User-Email", f"{sub}@dev.local")
        if not sub:
            raise AuthError("DEV bypass 모드: X-Debug-User-Sub 헤더 필요", 401)
        claims = {"sub": sub, "email": email, "name": email.split("@")[0]}
    else:
        token = _extract_token()
        claims = verify_id_token(token)

    with closing(get_db_connection()) as conn:
        with conn.cursor() as cur:
            user = upsert_user_from_claims(cur, claims)
            conn.commit()
    return user


def resolve_optional_user() -> dict | None:
    """토큰이 있으면 사용자를, 없거나 유효하지 않으면 None 을 반환.

    비회원도 들어올 수 있는 경로(/access/*)에서 "로그인했으면 누구인지"만
    알고 싶을 때 쓴다. 인증 실패를 401 로 바꾸지 않는 것이 require_auth 와의
    차이 — 거부 여부는 호출한 쪽의 정책이 정한다.
    """
    if not AUTH_DEV_BYPASS and not request.headers.get("Authorization"):
        return None
    try:
        return _resolve_user()
    except AuthError:
        return None


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            g.current_user = _resolve_user()
        except AuthError as e:
            return jsonify({"message": e.message}), e.status
        return fn(*args, **kwargs)

    return wrapper


def require_admin(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            g.current_user = _resolve_user()
        except AuthError as e:
            return jsonify({"message": e.message}), e.status
        if not g.current_user.get("is_admin"):
            return jsonify({"message": "Admin only"}), 403
        return fn(*args, **kwargs)

    return wrapper
