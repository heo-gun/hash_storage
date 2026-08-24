import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { hashFile } from "../utils/hash";
import type {
  BannerState,
  BreadcrumbItem,
  FsNode,
  UploadItem,
  Visibility,
} from "../types/fs";
import { getApiErrorMessage } from "../utils/apiError";

/** 동시에 진행할 업로드 수. 너무 높이면 브라우저 커넥션 한계에 걸린다. */
const UPLOAD_CONCURRENCY = 4;

/** "docs/img/a.png" → ["docs", "img"], "a.png" → [] */
function folderSegments(relPath: string): string[] {
  return relPath.split("/").slice(0, -1).filter(Boolean);
}

export function useFileManager() {
  const [nodes, setNodes] = useState<FsNode[]>([]);
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { node_id: null, name: "Root" },
  ]);

  const [folderName, setFolderName] = useState("");
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [visibility, setVisibility] = useState<Visibility>("private");

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [banner, setBanner] = useState<BannerState>(null);

  const currentPath = useMemo(
    () => breadcrumbs.map((b) => b.name).join(" / "),
    [breadcrumbs]
  );

  const folderCount = useMemo(
    () => nodes.filter((n) => n.node_type === "folder").length,
    [nodes]
  );
  const fileCount = useMemo(
    () => nodes.filter((n) => n.node_type === "file").length,
    [nodes]
  );

  async function loadNodes(parentId: string | null) {
    setLoading(true);
    try {
      const res = await api.get<FsNode[]>("/nodes", {
        params: parentId ? { parent_id: parentId } : {},
      });
      setNodes(res.data);
    } catch (error) {
      console.error(error);
      setBanner({
        text: "Could not load this folder. Check the API address and your connection.",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNodes(currentParentId);
  }, [currentParentId]);

  async function handleCreateFolder() {
    if (!folderName.trim()) return;

    try {
      setBanner(null);
      await api.post("/folders", {
        name: folderName.trim(),
        parent_id: currentParentId,
      });
      setFolderName("");
      setBanner({ text: "Folder created.", tone: "success" });
      await loadNodes(currentParentId);
    } catch (error: unknown) {
      console.error(error);
      setBanner({
        text: getApiErrorMessage(error, "Could not create the folder."),
        tone: "error",
      });
    }
  }

  function addFiles(files: FileList | File[] | null) {
    if (!files) return;
    const list = Array.from(files);
    if (list.length === 0) return;

    setQueue((prev) => [
      ...prev,
      ...list.map((file, i) => ({
        // File 객체엔 안정적인 id가 없어서 직접 만든다.
        id: `${Date.now()}-${prev.length + i}-${file.name}`,
        file,
        relPath:
          (file as File & { webkitRelativePath?: string })
            .webkitRelativePath || file.name,
        status: "pending" as const,
      })),
    ]);
  }

  function removeQueueItem(id: string) {
    setQueue((prev) => prev.filter((it) => it.id !== id));
  }

  function clearQueue() {
    setQueue([]);
  }

  function patchItem(id: string, patch: Partial<UploadItem>) {
    setQueue((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it))
    );
  }

  async function handleUpload() {
    const pending = queue.filter(
      (it) => it.status === "pending" || it.status === "error"
    );
    if (pending.length === 0) return;

    setUploading(true);
    setBanner({
      text: `Uploading ${pending.length} file(s)…`,
      tone: "neutral",
    });

    // 상대 경로 → 대상 폴더 node_id ("" 는 현재 폴더)
    const folderIds = new Map<string, string | null>([["", currentParentId]]);

    // 폴더 생성은 업로드 워커보다 먼저, 순차적으로 끝낸다. 병렬로 돌리면 경로
    // prefix 를 공유하는 요청끼리 같은 폴더를 동시에 INSERT 하려다 유니크
    // 제약에 걸린다.
    const distinctPaths = [
      ...new Set(pending.map((it) => folderSegments(it.relPath).join("/"))),
    ]
      .filter(Boolean)
      .sort((a, b) => a.split("/").length - b.split("/").length);

    try {
      for (const path of distinctPaths) {
        const res = await api.post<{ node_id: string }>(
          "/folders/ensure-path",
          { segments: path.split("/"), parent_id: currentParentId }
        );
        folderIds.set(path, res.data.node_id);
      }
    } catch (error: unknown) {
      console.error(error);
      setBanner({
        text: getApiErrorMessage(error, "Could not create the destination folder."),
        tone: "error",
      });
      setUploading(false);
      return;
    }

    let dedupedCount = 0;
    let errorCount = 0;
    let doneCount = 0;

    // pending 을 워커 여러 개가 나눠 소비 (동시성 제한)
    let cursor = 0;
    async function worker() {
      while (cursor < pending.length) {
        const item = pending[cursor++];
        try {
          patchItem(item.id, { status: "hashing", error: undefined });
          const hash = await hashFile(item.file);

          patchItem(item.id, { status: "uploading" });
          const parentId =
            folderIds.get(folderSegments(item.relPath).join("/")) ?? null;

          const formData = new FormData();
          formData.append("file", item.file);
          formData.append("hash_id", hash);
          formData.append("name", item.file.name);
          formData.append("visibility", visibility);
          if (parentId) formData.append("parent_id", parentId);

          const res = await api.post("/files/upload", formData);

          if (res.data?.deduplicated) {
            dedupedCount++;
            patchItem(item.id, { status: "deduped" });
          } else {
            patchItem(item.id, { status: "done" });
          }
          doneCount++;
        } catch (error: unknown) {
          errorCount++;
          console.error(error);
          patchItem(item.id, {
            status: "error",
            error: getApiErrorMessage(error, "Upload failed"),
          });
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(UPLOAD_CONCURRENCY, pending.length) }, worker)
    );

    const parts: string[] = [];
    if (doneCount) parts.push(`${doneCount} uploaded`);
    if (dedupedCount) parts.push(`${dedupedCount} reused an existing object`);
    if (errorCount) parts.push(`${errorCount} failed`);

    setBanner({
      text: parts.join(" · ") || "Nothing to upload.",
      tone: errorCount ? "error" : "success",
    });

    // 성공한 항목만 큐에서 비우고, 실패 항목은 재시도할 수 있게 남긴다.
    setQueue((prev) => prev.filter((it) => it.status === "error"));
    setUploading(false);
    await loadNodes(currentParentId);
  }

  async function handleDownload(node: FsNode) {
    if (node.node_type !== "file") return;
    try {
      setBanner(null);
      const res = await api.get(`/nodes/${node.node_id}/download`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = node.name;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setBanner({ text: "Download started.", tone: "success" });
    } catch (error) {
      console.error(error);
      setBanner({ text: "Download failed.", tone: "error" });
    }
  }

  async function handleDelete(node: FsNode) {
    const msg =
      node.node_type === "folder"
        ? `Delete "${node.name}" and everything inside it?`
        : `Delete "${node.name}"? If the same content exists elsewhere, the stored bytes stay.`;
    if (!window.confirm(msg)) return;

    try {
      await api.delete(`/nodes/${node.node_id}`);
      setBanner({ text: "Deleted.", tone: "success" });
      await loadNodes(currentParentId);
    } catch (error) {
      console.error(error);
      setBanner({ text: "Could not delete.", tone: "error" });
    }
  }

  async function handleChangeVisibility(node: FsNode, next: Visibility) {
    // 낙관적 갱신 — 실패하면 목록을 다시 불러 되돌린다.
    setNodes((prev) =>
      prev.map((n) =>
        n.node_id === node.node_id ? { ...n, visibility: next } : n
      )
    );
    try {
      const res = await api.patch<{ revoked_shares?: number }>(
        `/nodes/${node.node_id}/visibility`,
        { visibility: next }
      );
      // Shared 를 벗어나면 서버가 기존 링크를 끊는다. 조용히 끊으면 사용자가
      // 아직 살아있다고 착각하므로 몇 개가 끊겼는지 알린다.
      const revoked = res.data?.revoked_shares ?? 0;
      if (revoked > 0) {
        setBanner({
          text: `Changing access revoked ${revoked} existing share link(s).`,
          tone: "neutral",
        });
      }
    } catch (error) {
      console.error(error);
      setBanner({
        text: getApiErrorMessage(error, "Could not change access."),
        tone: "error",
      });
      await loadNodes(currentParentId);
    }
  }

  function openFolder(node: FsNode) {
    setCurrentParentId(node.node_id);
    setBreadcrumbs((prev) => [
      ...prev,
      { node_id: node.node_id, name: node.name },
    ]);
  }

  /** 그래프에서 폴더를 골랐을 때처럼, 중간 단계를 거치지 않고 경로로 바로 이동. */
  function jumpToPath(path: BreadcrumbItem[]) {
    const next = [{ node_id: null, name: "Root" }, ...path];
    setBreadcrumbs(next);
    setCurrentParentId(next[next.length - 1].node_id);
  }

  function moveToBreadCrumb(index: number) {
    const next = breadcrumbs.slice(0, index + 1);
    const target = next[next.length - 1];

    setBreadcrumbs(next);
    setCurrentParentId(target.node_id);
  }

  return {
    nodes,
    loading,
    uploading,
    banner,
    breadcrumbs,
    currentPath,
    folderCount,
    fileCount,
    folderName,
    setFolderName,
    queue,
    addFiles,
    removeQueueItem,
    clearQueue,
    visibility,
    setVisibility,
    handleCreateFolder,
    handleUpload,
    handleDownload,
    handleDelete,
    handleChangeVisibility,
    openFolder,
    jumpToPath,
    moveToBreadCrumb,
  };
}
