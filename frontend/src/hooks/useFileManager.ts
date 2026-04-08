import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { hashFile } from "../utils/hash";
import type {
  BannerState,
  BreadcrumbItem,
  FsNode,
} from "../types/fs";
import { getApiErrorMessage } from "../utils/apiError";

export function useFileManager() {
  const [nodes, setNodes] = useState<FsNode[]>([]);
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { node_id: null, name: "루트" },
  ]);

  const [folderName, setFolderName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
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
        text: "목록을 불러오지 못했습니다. API 주소와 네트워크를 확인해 주세요.",
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
      setBanner({ text: "폴더가 만들어졌습니다.", tone: "success" });
      await loadNodes(currentParentId);
    } catch (error: unknown) {
      console.error(error);
      setBanner({
        text: getApiErrorMessage(error, "폴더를 만들 수 없습니다."),
        tone: "error",
      });
    }
  }

  async function handleUpload() {
    if (!selectedFile) return;

    try {
      setLoading(true);
      setBanner({ text: "파일 해시를 계산하는 중입니다…", tone: "neutral" });

      const hash = await hashFile(selectedFile);

      setBanner({
        text: `업로드 중… (해시 ${hash.slice(0, 12)}…)`,
        tone: "neutral",
      });

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("hash_id", hash);
      formData.append("name", selectedFile.name);

      if (currentParentId) {
        formData.append("parent_id", currentParentId);
      }

      const res = await api.post("/files/upload", formData);

      if (res.data?.deduplicated) {
        setBanner({
          text: "이미 같은 내용의 파일이 있습니다. 새로 저장하지 않고 이 경로에만 연결했습니다.",
          tone: "success",
        });
      } else {
        setBanner({ text: "새 파일이 저장되었습니다.", tone: "success" });
      }

      setSelectedFile(null);
      await loadNodes(currentParentId);
    } catch (error: unknown) {
      console.error(error);
      setBanner({
        text: getApiErrorMessage(error, "업로드에 실패했습니다."),
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
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
      setBanner({ text: "다운로드를 시작했습니다.", tone: "success" });
    } catch (error) {
      console.error(error);
      setBanner({ text: "다운로드에 실패했습니다.", tone: "error" });
    }
  }

  async function handleDelete(node: FsNode) {
    const msg =
      node.node_type === "folder"
        ? `"${node.name}" 폴더와 그 안의 모든 하위 항목이 삭제됩니다. 계속할까요?`
        : `"${node.name}" 파일을 삭제할까요? 다른 경로에 같은 내용이 있으면 저장소의 바이트는 유지됩니다.`;
    if (!window.confirm(msg)) return;

    try {
      await api.delete(`/nodes/${node.node_id}`);
      setBanner({ text: "항목을 삭제했습니다.", tone: "success" });
      await loadNodes(currentParentId);
    } catch (error) {
      console.error(error);
      setBanner({ text: "삭제하지 못했습니다.", tone: "error" });
    }
  }

  function openFolder(node: FsNode) {
    setCurrentParentId(node.node_id);
    setBreadcrumbs((prev) => [
      ...prev,
      { node_id: node.node_id, name: node.name },
    ]);
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
    banner,
    breadcrumbs,
    currentPath,
    folderCount,
    fileCount,
    folderName,
    setFolderName,
    selectedFile,
    setSelectedFile,
    handleCreateFolder,
    handleUpload,
    handleDownload,
    handleDelete,
    openFolder,
    moveToBreadCrumb,
  };
}
