CREATE INDEX IF NOT EXISTS idx_fs_nodes_parent_id ON fs_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_fs_nodes_hash_id ON fs_nodes(hash_id);
CREATE INDEX IF NOT EXISTS idx_file_blobs_ref_count ON file_blobs(ref_count);

-- 같은 폴더 내 중복 파일명 방지 (parent_id NULL = 루트 레벨도 포함)
-- NULLS NOT DISTINCT: PostgreSQL 15+, 두 루트 항목이 같은 이름을 가질 수 없도록
CREATE UNIQUE INDEX IF NOT EXISTS uq_fs_nodes_parent_name
    ON fs_nodes(COALESCE(parent_id::text, ''), name);