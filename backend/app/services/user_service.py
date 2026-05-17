"""유저 관련 비즈니스 로직.

- upsert_user_from_claims: Cognito claims로 lazy provisioning
- check_quota: 업로드 전 quota 검사
- adjust_used_bytes: 업로드/삭제 시 used_bytes 가감
"""


class QuotaExceeded(Exception):
    def __init__(self, used: int, quota: int, attempted: int):
        self.used = used
        self.quota = quota
        self.attempted = attempted
        super().__init__(
            f"Storage quota exceeded: used={used} + attempted={attempted} > quota={quota}"
        )


def upsert_user_from_claims(cur, claims: dict) -> dict:
    """Cognito JWT claims로 users 행을 가져오거나 만든다.

    claims 예: {"sub": "uuid", "email": "x@y.z", "name": "...", ...}
    """
    sub = claims["sub"]
    email = claims.get("email") or f"{sub}@unknown.local"
    display_name = claims.get("name") or claims.get("cognito:username") or email.split("@")[0]

    cur.execute(
        """
        INSERT INTO users (cognito_sub, email, display_name)
        VALUES (%s, %s, %s)
        ON CONFLICT (cognito_sub) DO UPDATE
            SET email = EXCLUDED.email,
                display_name = COALESCE(EXCLUDED.display_name, users.display_name),
                updated_at = NOW()
        RETURNING user_id, cognito_sub, email, display_name,
                  quota_bytes, used_bytes, is_admin, created_at
        """,
        (sub, email, display_name),
    )
    return cur.fetchone()


def check_quota(cur, user_id, additional_bytes: int) -> None:
    """업로드하려는 크기를 더해도 quota를 넘지 않는지 확인. 넘으면 QuotaExceeded."""
    cur.execute(
        "SELECT quota_bytes, used_bytes FROM users WHERE user_id = %s FOR UPDATE",
        (user_id,),
    )
    row = cur.fetchone()
    if not row:
        raise QuotaExceeded(0, 0, additional_bytes)
    if row["used_bytes"] + additional_bytes > row["quota_bytes"]:
        raise QuotaExceeded(row["used_bytes"], row["quota_bytes"], additional_bytes)


def adjust_used_bytes(cur, user_id, delta: int) -> None:
    """used_bytes를 delta만큼 증감. 음수도 가능. CHECK 제약으로 0 미만은 방지됨."""
    cur.execute(
        """
        UPDATE users
        SET used_bytes = GREATEST(used_bytes + %s, 0),
            updated_at = NOW()
        WHERE user_id = %s
        """,
        (delta, user_id),
    )
