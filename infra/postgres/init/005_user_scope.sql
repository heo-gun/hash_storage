-- Phase 2: fs_nodes에 owner_id 추가, 모든 인덱스/유니크 제약을 user-scope로 변경
-- file_blobs는 글로벌 dedup 레이어로 그대로 유지 (ref_count는 전체 참조 카운트)

ALTER TABLE fs_nodes
    ADD COLUMN IF NOT EXISTS owner_id UUID NOT NULL
        REFERENCES users(user_id) ON DELETE CASCADE;

-- 기존 글로벌 unique 제약 제거 (003에서 만든 것)
DROP INDEX IF EXISTS uq_fs_nodes_parent_name;

-- 같은 유저의 같은 폴더 안에서만 이름 중복 금지
CREATE UNIQUE INDEX IF NOT EXISTS uq_fs_nodes_owner_parent_name
    ON fs_nodes(owner_id, COALESCE(parent_id::text, ''), name);

-- user-scope 탐색 최적화
CREATE INDEX IF NOT EXISTS idx_fs_nodes_owner_parent
    ON fs_nodes(owner_id, parent_id);
