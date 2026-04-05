import { useEffect, useMemo, useState } from "react";
import { api } from "./services/api";
import { hashFile } from "./utils/hash";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Download,
  FileUp,
  FolderInput,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Inbox,
  Loader2,
  MapPin,
  Trash2,
  XCircle,
} from "lucide-react";
import clsx from "clsx";

type NodeType = "file" | "folder";

type FsNode = {
  node_id: string;
  parent_id: string | null;
  node_type: NodeType;
  name: string;
  hash_id: string | null;
  created_at: string;
  updated_at: string;
};

type BreadcrumbItem = {
  node_id: string | null;
  name: string;
};

type BannerTone = "neutral" | "success" | "error";

function App() {
  const [nodes, setNodes] = useState<FsNode[]>([]);
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { node_id: null, name: "루트" },
  ]);

  const [folderName, setFolderName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{
    text: string;
    tone: BannerTone;
  } | null>(null);

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
      const msg =
        error &&
        typeof error === "object" &&
        "response" in error &&
        error.response &&
        typeof error.response === "object" &&
        "data" in error.response &&
        error.response.data &&
        typeof error.response.data === "object" &&
        "message" in error.response.data
          ? String(
              (error.response.data as { message?: string }).message ?? ""
            )
          : "폴더를 만들 수 없습니다.";
      setBanner({ text: msg || "폴더를 만들 수 없습니다.", tone: "error" });
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
      const msg =
        error &&
        typeof error === "object" &&
        "response" in error &&
        error.response &&
        typeof error.response === "object" &&
        "data" in error.response &&
        error.response.data &&
        typeof error.response.data === "object" &&
        "message" in error.response.data
          ? String(
              (error.response.data as { message?: string }).message ?? ""
            )
          : "업로드에 실패했습니다.";
      setBanner({ text: msg || "업로드에 실패했습니다.", tone: "error" });
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50/80">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        {/* 헤더 */}
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/25">
              <HardDrive className="h-7 w-7" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                파일 저장소
              </h1>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-600">
                중복 제거(CAS)와 폴더 트리로 파일을 관리합니다. 아래에서{" "}
                <strong className="font-medium text-slate-800">위치</strong>를
                고른 뒤 폴더를 만들거나 파일을 올리세요.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {["CAS 해시", "PostgreSQL", "MinIO"].map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-2.5 py-0.5 text-xs font-medium text-slate-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </header>

        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/50">
          {/* 현재 위치 */}
          <section
            className="border-b border-slate-100 bg-slate-50/90 px-5 py-4 sm:px-6"
            aria-labelledby="location-heading"
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              <span id="location-heading">지금 보고 있는 폴더</span>
            </div>
            <nav
              className="mt-3 flex flex-wrap items-center gap-1 text-sm"
              aria-label="폴더 경로"
            >
              {breadcrumbs.map((item, index) => (
                <span key={`${item.node_id ?? "root"}-${index}`} className="flex items-center gap-1">
                  {index > 0 && (
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-slate-300"
                      aria-hidden
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => moveToBreadCrumb(index)}
                    className={clsx(
                      "rounded-lg px-2.5 py-1 font-medium transition",
                      index === breadcrumbs.length - 1
                        ? "bg-indigo-100 text-indigo-900"
                        : "text-slate-700 hover:bg-white hover:text-slate-900"
                    )}
                  >
                    {item.name}
                  </button>
                </span>
              ))}
            </nav>
            <p className="mt-2 font-mono text-xs text-slate-500">{currentPath}</p>
          </section>

          {/* 작업 영역 */}
          <div className="grid gap-4 border-b border-slate-100 p-5 sm:p-6 md:grid-cols-2">
            <section
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              aria-labelledby="folder-create-heading"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                  <FolderPlus className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h2
                    id="folder-create-heading"
                    className="text-base font-semibold text-slate-900"
                  >
                    새 폴더
                  </h2>
                  <p className="text-xs text-slate-500">
                    현재 위치 아래에 빈 폴더를 만듭니다.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="sr-only" htmlFor="folder-name">
                  폴더 이름
                </label>
                <input
                  id="folder-name"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="예: 문서, 이미지"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm outline-none ring-indigo-500/0 transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  type="button"
                  onClick={handleCreateFolder}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.99]"
                >
                  <FolderInput className="h-4 w-4" aria-hidden />
                  만들기
                </button>
              </div>
            </section>

            <section
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              aria-labelledby="upload-heading"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <FileUp className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h2
                    id="upload-heading"
                    className="text-base font-semibold text-slate-900"
                  >
                    파일 업로드
                  </h2>
                  <p className="text-xs text-slate-500">
                    SHA-256 해시로 중복 여부를 판단한 뒤 저장합니다.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 transition hover:border-emerald-300 hover:bg-emerald-50/30">
                  <UploadIconLabel file={selectedFile} />
                  <input
                    type="file"
                    className="sr-only"
                    onChange={(e) =>
                      setSelectedFile(e.target.files?.[0] ?? null)
                    }
                  />
                </label>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={!selectedFile || loading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45 active:scale-[0.99]"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <FileUp className="h-4 w-4" aria-hidden />
                  )}
                  이 폴더에 업로드
                </button>
              </div>
            </section>
          </div>

          {/* 알림 */}
          {banner && (
            <div
              role="status"
              className={clsx(
                "mx-5 mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm sm:mx-6",
                banner.tone === "success" &&
                  "border-emerald-200 bg-emerald-50 text-emerald-900",
                banner.tone === "error" &&
                  "border-red-200 bg-red-50 text-red-900",
                banner.tone === "neutral" &&
                  "border-amber-200 bg-amber-50 text-amber-900"
              )}
            >
              {banner.tone === "success" && (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              )}
              {banner.tone === "error" && (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              )}
              {banner.tone === "neutral" && (
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              )}
              <span className="leading-relaxed">{banner.text}</span>
            </div>
          )}

          {/* 목록 */}
          <section className="p-5 sm:p-6" aria-labelledby="list-heading">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-slate-600" aria-hidden />
                <h2
                  id="list-heading"
                  className="text-lg font-semibold text-slate-900"
                >
                  이 폴더 안의 항목
                </h2>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">
                  폴더 {folderCount}
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">
                  파일 {fileCount}
                </span>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 py-16 text-slate-600">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                불러오는 중…
              </div>
            ) : nodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
                <Inbox
                  className="mb-3 h-12 w-12 text-slate-300"
                  strokeWidth={1.25}
                  aria-hidden
                />
                <p className="font-medium text-slate-700">항목이 없습니다</p>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  폴더를 만들거나 파일을 업로드하면 여기 표시됩니다.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">이름</th>
                      <th className="hidden px-4 py-3 sm:table-cell">유형</th>
                      <th className="hidden px-4 py-3 md:table-cell">
                        해시 (앞부분)
                      </th>
                      <th className="px-4 py-3 text-right">동작</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {nodes.map((node) => (
                      <tr
                        key={node.node_id}
                        className={clsx(
                          "transition hover:bg-slate-50/80",
                          node.node_type === "folder" && "bg-blue-50/40"
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {node.node_type === "folder" ? (
                              <FolderOpen className="h-4 w-4 shrink-0 text-blue-600" />
                            ) : (
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-500">
                                <span className="text-xs" aria-hidden>
                                  📄
                                </span>
                              </span>
                            )}
                            <span className="font-medium text-slate-900">
                              {node.name}
                            </span>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <span
                            className={clsx(
                              "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
                              node.node_type === "folder"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-slate-200/80 text-slate-800"
                            )}
                          >
                            {node.node_type === "folder" ? "폴더" : "파일"}
                          </span>
                        </td>
                        <td className="hidden font-mono text-xs text-slate-500 md:table-cell">
                          {node.hash_id
                            ? `${node.hash_id.slice(0, 16)}…`
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            {node.node_type === "folder" && (
                              <button
                                type="button"
                                onClick={() => openFolder(node)}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
                              >
                                안으로 들어가기
                              </button>
                            )}
                            {node.node_type === "file" && (
                              <button
                                type="button"
                                onClick={() => handleDownload(node)}
                                className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-900 transition hover:bg-indigo-100"
                              >
                                <Download className="h-3.5 w-3.5" aria-hidden />
                                받기
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDelete(node)}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-800 transition hover:bg-red-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function UploadIconLabel({ file }: { file: File | null }) {
  return (
    <>
      <FileUp className="mb-2 h-8 w-8 text-slate-400" strokeWidth={1.5} />
      <span className="text-sm font-medium text-slate-700">
        {file ? file.name : "클릭해서 파일 선택"}
      </span>
      <span className="mt-1 text-xs text-slate-500">
        {file
          ? `${(file.size / 1024).toFixed(1)} KB`
          : "선택한 뒤 아래 버튼으로 이 폴더에 올립니다."}
      </span>
    </>
  );
}

export default App;
