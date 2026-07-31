-- Phase 3: .epf 보호 공유
--
-- 접근 주체는 "링크 토큰"이다. 수신자가 castor 계정이 없어도 열람할 수 있어야
-- 하므로 grantee_user_id 는 nullable 이고, grantee_email 은 워터마크에 찍을
-- 식별자 용도로만 쓴다(인증 수단이 아니다).

CREATE TABLE IF NOT EXISTS access_grants (
    grant_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id         UUID NOT NULL REFERENCES fs_nodes(node_id) ON DELETE CASCADE,
    grantor_id      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

    -- 링크에 들어가는 추측 불가 토큰. 이것이 사실상의 접근 자격 증명이다.
    share_token     TEXT NOT NULL UNIQUE,

    -- 수신자 표시용. NULL 이면 "링크를 아는 누구나".
    grantee_email   TEXT,
    grantee_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,

    expires_at      TIMESTAMPTZ,
    max_views       INTEGER,
    max_prints      INTEGER,
    view_count      INTEGER NOT NULL DEFAULT 0,
    print_count     INTEGER NOT NULL DEFAULT 0,
    allow_download  BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT access_grants_max_views_positive
        CHECK (max_views IS NULL OR max_views > 0),
    CONSTRAINT access_grants_max_prints_positive
        CHECK (max_prints IS NULL OR max_prints >= 0)
);

CREATE INDEX IF NOT EXISTS idx_access_grants_node ON access_grants(node_id);
CREATE INDEX IF NOT EXISTS idx_access_grants_grantor
    ON access_grants(grantor_id, created_at DESC);

-- CEK(Content Encryption Key)는 평문으로 저장하지 않는다.
-- 마스터키(EPF_MASTER_KEY, 추후 KMS)로 AES-256-GCM wrap 한 결과만 보관.
CREATE TABLE IF NOT EXISTS content_keys (
    key_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grant_id    UUID NOT NULL REFERENCES access_grants(grant_id) ON DELETE CASCADE,
    wrapped_cek BYTEA NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_content_keys_grant ON content_keys(grant_id);

-- 열람/인쇄/차단 이력. 워터마크만으로는 부족한 사후 추적용.
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id      BIGSERIAL PRIMARY KEY,
    grant_id    UUID REFERENCES access_grants(grant_id) ON DELETE CASCADE,
    action      TEXT NOT NULL,
    actor_label TEXT,
    ip_address  TEXT,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT audit_logs_action_check
        CHECK (action IN ('view', 'print', 'download', 'denied'))
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_grant
    ON audit_logs(grant_id, created_at DESC);
