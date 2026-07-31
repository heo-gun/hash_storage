"""access_grants 정책 검증 / 카운트 증가.

정책 검증과 카운트 증가는 반드시 같은 트랜잭션 안에서 행 잠금을 걸고 해야 한다.
그렇지 않으면 같은 링크로 동시에 여러 탭을 열었을 때 max_views 를 넘겨서 열람된다.
"""
import secrets
from datetime import datetime, timezone

from flask import request

TOKEN_BYTES = 32  # 256비트 — 무차별 대입 불가


class PolicyDenied(Exception):
    def __init__(self, reason: str, status: int = 403):
        super().__init__(reason)
        self.reason = reason
        self.status = status


def new_share_token() -> str:
    return secrets.token_urlsafe(TOKEN_BYTES)


def _client_ip() -> str | None:
    # nginx 뒤에 있으므로 X-Forwarded-For 의 첫 항목이 실제 클라이언트다.
    fwd = request.headers.get("X-Forwarded-For", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.remote_addr


def write_audit(cur, grant_id, action: str, actor_label: str | None = None) -> None:
    cur.execute(
        """
        INSERT INTO audit_logs (grant_id, action, actor_label, ip_address, user_agent)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (
            grant_id,
            action,
            actor_label,
            _client_ip(),
            (request.headers.get("User-Agent") or "")[:500],
        ),
    )


def load_grant_for_update(cur, token: str) -> dict:
    """토큰으로 grant 를 잠근 채 읽어온다. 파일 메타데이터까지 join.

    호출자는 반드시 트랜잭션 안에서 쓰고, 끝나면 commit/rollback 해야 한다.
    """
    cur.execute(
        """
        SELECT g.*, n.name, n.node_type, b.mime_type, b.size_bytes, b.s3_key
        FROM access_grants g
        JOIN fs_nodes n ON g.node_id = n.node_id
        LEFT JOIN file_blobs b ON n.hash_id = b.hash_id
        WHERE g.share_token = %s
        FOR UPDATE OF g
        """,
        (token,),
    )
    grant = cur.fetchone()
    if not grant:
        # 존재하지 않는 토큰과 취소된 토큰을 구분해주지 않는다 (열거 방지).
        raise PolicyDenied("공유를 찾을 수 없거나 더 이상 유효하지 않습니다", 404)
    return grant


def assert_viewable(grant: dict) -> None:
    """열람 가능 여부만 판단. 카운트는 건드리지 않는다."""
    if grant["revoked_at"] is not None:
        raise PolicyDenied("공유가 취소되었습니다")

    expires_at = grant["expires_at"]
    if expires_at is not None and expires_at <= datetime.now(timezone.utc):
        raise PolicyDenied("공유 링크가 만료되었습니다")

    max_views = grant["max_views"]
    if max_views is not None and grant["view_count"] >= max_views:
        raise PolicyDenied("열람 가능 횟수를 모두 사용했습니다")

    if grant["node_type"] != "file" or not grant["s3_key"]:
        raise PolicyDenied("공유된 파일을 찾을 수 없습니다", 404)


def consume_view(cur, grant: dict) -> int:
    """열람 1회를 소비하고 남은 횟수를 반환. 무제한이면 -1."""
    assert_viewable(grant)
    cur.execute(
        "UPDATE access_grants SET view_count = view_count + 1 WHERE grant_id = %s "
        "RETURNING view_count",
        (grant["grant_id"],),
    )
    used = cur.fetchone()["view_count"]
    write_audit(cur, grant["grant_id"], "view", grant["grantee_email"])
    return -1 if grant["max_views"] is None else max(grant["max_views"] - used, 0)


def consume_print(cur, grant: dict) -> int:
    assert_viewable(grant)
    max_prints = grant["max_prints"]
    if max_prints is not None and grant["print_count"] >= max_prints:
        write_audit(cur, grant["grant_id"], "denied", grant["grantee_email"])
        raise PolicyDenied("인쇄 가능 횟수를 모두 사용했습니다")

    cur.execute(
        "UPDATE access_grants SET print_count = print_count + 1 WHERE grant_id = %s "
        "RETURNING print_count",
        (grant["grant_id"],),
    )
    used = cur.fetchone()["print_count"]
    write_audit(cur, grant["grant_id"], "print", grant["grantee_email"])
    return -1 if max_prints is None else max(max_prints - used, 0)


def public_policy_view(grant: dict) -> dict:
    """수신자에게 내려보낼 정책 요약. 내부 식별자는 넣지 않는다."""
    max_views = grant["max_views"]
    max_prints = grant["max_prints"]
    return {
        "file_name": grant["name"],
        "mime_type": grant["mime_type"],
        "size_bytes": grant["size_bytes"],
        "expires_at": grant["expires_at"].isoformat() if grant["expires_at"] else None,
        "allow_download": grant["allow_download"],
        "grantee_email": grant["grantee_email"],
        "views_remaining": -1 if max_views is None else max(max_views - grant["view_count"], 0),
        "prints_remaining": -1 if max_prints is None else max(max_prints - grant["print_count"], 0),
    }
