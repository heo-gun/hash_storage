-- Phase 2.5: 노드 공개 범위(visibility)
--   private — 소유자만 (기본값)
--   public  — 모든 사용자에게 공개, /search 에서 검색 가능
--   shared  — 명시적으로 지정된 수신자만 (Phase 3 access_grants 에서 사용)

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE fs_nodes
    ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private';

ALTER TABLE fs_nodes
    DROP CONSTRAINT IF EXISTS fs_nodes_visibility_check;

ALTER TABLE fs_nodes
    ADD CONSTRAINT fs_nodes_visibility_check
        CHECK (visibility IN ('private', 'public', 'shared'));

-- 공개 파일 검색용 부분 인덱스: 전체 노드 중 public file 만 색인
CREATE INDEX IF NOT EXISTS idx_fs_nodes_public_files
    ON fs_nodes(created_at DESC)
    WHERE visibility = 'public' AND node_type = 'file';

-- 이름 부분 일치 검색 가속 (pg_trgm)
CREATE INDEX IF NOT EXISTS idx_fs_nodes_public_name_trgm
    ON fs_nodes USING gin (name gin_trgm_ops)
    WHERE visibility = 'public' AND node_type = 'file';
