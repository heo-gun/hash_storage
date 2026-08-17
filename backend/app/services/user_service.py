class QuotaExceeded(Exception):
    def __init__(self, used: int, quota: int, attempted: int):
        self.used = used
        self.quota = quota
        self.attempted = attempted
        super().__init__(
            f"Storage quota exceeded: used={used} + attempted={attempted} > quota={quota}"
        )


def upsert_user_from_claims(cur, claims: dict) -> dict:
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
    cur.execute(
        """
        UPDATE users
        SET used_bytes = GREATEST(used_bytes + %s, 0),
            updated_at = NOW()
        WHERE user_id = %s
        """,
        (delta, user_id),
    )
