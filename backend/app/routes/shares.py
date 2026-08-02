"""보호 공유 관리 — 소유자용 (인증 필요)."""
import re
from contextlib import closing
from datetime import datetime, timedelta, timezone

from flask import g, jsonify, request

from app.auth.middleware import require_auth
from app.config import PUBLIC_BASE_URL
from app.db import get_db_connection
from app.routes import bp
from app.services.epf_service import EpfError, generate_cek, is_protectable, wrap_cek
from app.services.share_service import new_share_token, normalize_email

MAX_EXPIRES_DAYS = 365
MAX_RECIPIENTS = 20

# 형식만 거른다. 실제 도달 가능성은 검증하지 않는다(수신 확인 수단이 아님).
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$")


def _share_url(token: str) -> str:
    base = PUBLIC_BASE_URL or request.host_url.rstrip("/")
    return f"{base}/view/{token}"


def _optional_int(data: dict, key: str, *, allow_zero: bool = False) -> int | None:
    """None/빈 문자열이면 '제한 없음'.

    max_prints 는 0 이 "인쇄 금지"라는 의미를 가지므로 allow_zero 로 구분한다.
    """
    value = data.get(key)
    if value is None or value == "":
        return None
    try:
        n = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{key} 는 정수여야 합니다")

    minimum = 0 if allow_zero else 1
    if n < minimum:
        raise ValueError(f"{key} 는 {minimum} 이상이어야 합니다")
    return n


def _recipients(data: dict) -> list[str | None]:
    """수신자 목록을 정규화. 빈 목록이면 [None] = "링크를 아는 누구나" 1건.

    수신자마다 별도 grant(=별도 토큰)를 발급한다. 한 토큰을 여러 명이 나눠
    쓰면 개별 취소도, 누가 열었는지 구분도 불가능해진다.
    """
    raw = data.get("grantee_emails")
    if raw is None:
        # 이전 단수 필드도 계속 받는다.
        raw = [data["grantee_email"]] if data.get("grantee_email") else []
    if not isinstance(raw, list):
        raise ValueError("grantee_emails 는 배열이어야 합니다")

    seen: list[str | None] = []
    for item in raw:
        email = normalize_email(item if isinstance(item, str) else None)
        if email is None:
            continue
        if not EMAIL_RE.match(email):
            raise ValueError(f"올바른 이메일이 아닙니다: {item}")
        if email not in seen:
            seen.append(email)

    if not seen:
        return [None]
    if len(seen) > MAX_RECIPIENTS:
        raise ValueError(f"수신자는 최대 {MAX_RECIPIENTS}명까지입니다")
    return seen


@bp.route("/shares", methods=["POST"])
@require_auth
def create_share():
    data = request.get_json(force=True)
    node_id = data.get("node_id")
    owner_id = g.current_user["user_id"]

    if not node_id:
        return jsonify({"message": "node_id is required"}), 400

    try:
        max_views = _optional_int(data, "max_views")
        max_prints = _optional_int(data, "max_prints", allow_zero=True)
        expires_in_days = _optional_int(data, "expires_in_days")
        recipients = _recipients(data)
    except ValueError as e:
        return jsonify({"message": str(e)}), 400

    if expires_in_days and expires_in_days > MAX_EXPIRES_DAYS:
        return jsonify({"message": f"만료는 최대 {MAX_EXPIRES_DAYS}일입니다"}), 400

    expires_at = (
        datetime.now(timezone.utc) + timedelta(days=expires_in_days)
        if expires_in_days
        else None
    )
    allow_download = bool(data.get("allow_download"))
    shares = []

    with closing(get_db_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT n.node_id, n.name, n.visibility, b.mime_type
                FROM fs_nodes n
                LEFT JOIN file_blobs b ON n.hash_id = b.hash_id
                WHERE n.node_id = %s AND n.owner_id = %s AND n.node_type = 'file'
                """,
                (node_id, owner_id),
            )
            node = cur.fetchone()
            if not node:
                return jsonify({"message": "File not found"}), 404

            # 공개 범위가 곧 공유 의도다. private/public 인 파일에 링크를 발급하면
            # 목록에 표시된 범위와 실제 접근 가능 범위가 어긋난다.
            if node["visibility"] != "shared":
                return jsonify({
                    "message": "공개 범위를 Shared 로 바꾼 뒤에 공유할 수 있습니다",
                    "visibility": node["visibility"],
                }), 409

            if not is_protectable(node["mime_type"]):
                return jsonify({
                    "message": "보호 공유는 PDF 와 이미지 파일만 지원합니다",
                    "mime_type": node["mime_type"],
                }), 415

            for grantee_email in recipients:
                try:
                    wrapped = wrap_cek(generate_cek())
                except EpfError as e:
                    # 마스터키 미설정은 운영 설정 문제이므로 503 이 맞다.
                    return jsonify({"message": str(e)}), 503

                token = new_share_token()
                cur.execute(
                    """
                    INSERT INTO access_grants
                        (node_id, grantor_id, share_token, grantee_email,
                         expires_at, max_views, max_prints, allow_download)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING grant_id, created_at
                    """,
                    (node_id, owner_id, token, grantee_email, expires_at,
                     max_views, max_prints, allow_download),
                )
                grant = cur.fetchone()

                cur.execute(
                    "INSERT INTO content_keys (grant_id, wrapped_cek) VALUES (%s, %s)",
                    (grant["grant_id"], wrapped),
                )

                shares.append({
                    "grant_id": grant["grant_id"],
                    "share_url": _share_url(token),
                    "grantee_email": grantee_email,
                    "created_at": grant["created_at"],
                })

            conn.commit()

    return jsonify({
        "file_name": node["name"],
        "expires_at": expires_at.isoformat() if expires_at else None,
        "max_views": max_views,
        "max_prints": max_prints,
        "allow_download": allow_download,
        "shares": shares,
    }), 201


@bp.route("/shares", methods=["GET"])
@require_auth
def list_shares():
    owner_id = g.current_user["user_id"]
    node_id = request.args.get("node_id")

    sql = """
        SELECT g.grant_id, g.share_token, g.node_id, n.name AS file_name,
               g.grantee_email, g.expires_at, g.max_views, g.max_prints,
               g.view_count, g.print_count, g.allow_download,
               g.revoked_at, g.created_at
        FROM access_grants g
        JOIN fs_nodes n ON g.node_id = n.node_id
        WHERE g.grantor_id = %s
    """
    params: list = [owner_id]
    if node_id:
        sql += " AND g.node_id = %s"
        params.append(node_id)
    sql += " ORDER BY g.created_at DESC"

    with closing(get_db_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, tuple(params))
            rows = cur.fetchall()

    for r in rows:
        r["share_url"] = _share_url(r.pop("share_token"))

    return jsonify(rows)


@bp.route("/shares/<grant_id>", methods=["DELETE"])
@require_auth
def revoke_share(grant_id):
    owner_id = g.current_user["user_id"]

    with closing(get_db_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE access_grants SET revoked_at = now()
                WHERE grant_id = %s AND grantor_id = %s AND revoked_at IS NULL
                RETURNING grant_id
                """,
                (grant_id, owner_id),
            )
            if not cur.fetchone():
                return jsonify({"message": "Share not found"}), 404
            conn.commit()

    return jsonify({"message": "revoked", "grant_id": grant_id})


@bp.route("/shares/<grant_id>/audit", methods=["GET"])
@require_auth
def share_audit(grant_id):
    owner_id = g.current_user["user_id"]

    with closing(get_db_connection()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM access_grants WHERE grant_id = %s AND grantor_id = %s",
                (grant_id, owner_id),
            )
            if not cur.fetchone():
                return jsonify({"message": "Share not found"}), 404

            cur.execute(
                """
                SELECT action, actor_label, ip_address, user_agent, created_at
                FROM audit_logs WHERE grant_id = %s
                ORDER BY created_at DESC LIMIT 200
                """,
                (grant_id,),
            )
            rows = cur.fetchall()

    return jsonify(rows)
