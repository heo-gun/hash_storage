CREATE TABLE IF NOT EXISTS file_blobs (
    hash_id TEXT PRIMARY KEY,
    size_bytes BIGINT NOT NULL,
    mime_type TEXT,
    s3_key TEXT NOT NULL UNIQUE,
    ref_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fs_nodes (
    node_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NULL REFERENCES fs_nodes(node_id) ON DELETE CASCADE,
    node_type TEXT NOT NULL CHECK (node_type IN ('folder', 'file')),
    name TEXT NOT NULL,
    hash_id TEXT NULL REFERENCES file_blobs(hash_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);