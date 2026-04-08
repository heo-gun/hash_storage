export type NodeType = "file" | "folder";

export type FsNode = {
  node_id: string;
  parent_id: string | null;
  node_type: NodeType;
  name: string;
  hash_id: string | null;
  created_at: string;
  updated_at: string;
};

export type BreadcrumbItem = {
  node_id: string | null;
  name: string;
};

export type BannerTone = "neutral" | "success" | "error";

export type BannerState = {
  text: string;
  tone: BannerTone;
} | null;
