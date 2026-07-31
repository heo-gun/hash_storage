export type NodeType = "file" | "folder";

export type Visibility = "private" | "public" | "shared";

export type FsNode = {
  node_id: string;
  parent_id: string | null;
  node_type: NodeType;
  name: string;
  hash_id: string | null;
  visibility: Visibility;
  created_at: string;
  updated_at: string;
};

/** 업로드 큐의 한 항목. relPath 는 폴더 업로드 시의 상대 경로(빈 문자열이면 현재 폴더). */
export type UploadItem = {
  id: string;
  file: File;
  relPath: string;
  status: "pending" | "hashing" | "uploading" | "done" | "deduped" | "error";
  error?: string;
};

export type PublicSearchResult = {
  node_id: string;
  name: string;
  created_at: string;
  size_bytes: number;
  mime_type: string | null;
  owner_name: string | null;
};

export type PublicSearchResponse = {
  query: string;
  total: number;
  limit: number;
  offset: number;
  results: PublicSearchResult[];
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
