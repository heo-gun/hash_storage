CREATE INDEX IF NOT EXISTS idx_fs_nodes_parent_id ON fs_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_fs_nodes_parent_name ON fs_nodes(parent_id, name);
CREATE INDEX IF NOT EXISTS idx_fs_nodes_hash_id ON fs_nodes(hash_id);
CREATE INDEX IF NOT EXISTS idx_file_blobs_ref_count ON file_blobs(ref_count);