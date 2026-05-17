-- Phase 2: 사용자 테이블
-- Cognito User Pool의 sub claim과 1:1 매핑. 첫 로그인 시 lazy provisioning.

CREATE TABLE IF NOT EXISTS users (
    user_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cognito_sub    TEXT NOT NULL UNIQUE,
    email          TEXT NOT NULL,
    display_name   TEXT,
    quota_bytes    BIGINT NOT NULL DEFAULT 53687091200,  -- 50 GiB
    used_bytes     BIGINT NOT NULL DEFAULT 0 CHECK (used_bytes >= 0),
    is_admin       BOOLEAN NOT NULL DEFAULT false,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
