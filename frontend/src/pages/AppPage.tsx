import { useState } from "react";
import { List, Network } from "lucide-react";
import clsx from "clsx";

import { useFileManager } from "../hooks/useFileManager";
import { ShareModal } from "../components/file-manager/ShareModal";
import type { BreadcrumbItem, FsNode } from "../types/fs";
import { AppHeader } from "../components/file-manager/AppHeader";
import { LocationSection } from "../components/file-manager/LocationSection";
import { FolderCreateCard } from "../components/file-manager/FolderCreateCard";
import { UploadCard } from "../components/file-manager/UploadCard";
import { BannerAlert } from "../components/file-manager/BannerAlert";
import { NodeListTable } from "../components/file-manager/NodeListTable";
import { GraphPanel } from "../components/graph/GraphPanel";

type View = "list" | "graph";

export function AppPage() {
  const fm = useFileManager();
  const [sharing, setSharing] = useState<FsNode | null>(null);
  const [view, setView] = useState<View>("list");

  function handleGraphOpenFolder(path: BreadcrumbItem[]) {
    fm.jumpToPath(path);
    setView("list");
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* Subtle hash watermark, like landing */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 select-none overflow-hidden opacity-[0.025] font-mono text-[140px] leading-none text-ink whitespace-nowrap"
      >
        <div className="-rotate-[8deg] translate-y-32 translate-x-12">
          7a3f8b2e1d9c4f5a6b8c0d1e2f3a4b5c6d7e8f9a
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-12">
        <AppHeader />

        <div className="overflow-hidden rounded-2xl border border-hairline bg-surface-1">
          <LocationSection
            breadcrumbs={fm.breadcrumbs}
            currentPath={fm.currentPath}
            onNavigateCrumb={fm.moveToBreadCrumb}
          />

          <div className="grid gap-4 border-b border-hairline p-6 md:grid-cols-2">
            <FolderCreateCard
              folderName={fm.folderName}
              onFolderNameChange={fm.setFolderName}
              onSubmit={fm.handleCreateFolder}
            />
            <UploadCard
              queue={fm.queue}
              uploading={fm.uploading}
              visibility={fm.visibility}
              onVisibilityChange={fm.setVisibility}
              onAddFiles={fm.addFiles}
              onRemoveItem={fm.removeQueueItem}
              onClearQueue={fm.clearQueue}
              onUpload={fm.handleUpload}
            />
          </div>

          <BannerAlert banner={fm.banner} />

          <div
            role="tablist"
            aria-label="보기 전환"
            className="flex gap-1 border-b border-hairline px-6 pt-5"
          >
            <ViewTab
              active={view === "list"}
              onClick={() => setView("list")}
              Icon={List}
              label="List"
            />
            <ViewTab
              active={view === "graph"}
              onClick={() => setView("graph")}
              Icon={Network}
              label="Graph"
            />
          </div>

          {view === "list" ? (
            <NodeListTable
              nodes={fm.nodes}
              loading={fm.loading}
              folderCount={fm.folderCount}
              fileCount={fm.fileCount}
              onOpenFolder={fm.openFolder}
              onDownload={fm.handleDownload}
              onDelete={fm.handleDelete}
              onChangeVisibility={fm.handleChangeVisibility}
              onShare={setSharing}
            />
          ) : (
            <GraphPanel onOpenFolder={handleGraphOpenFolder} />
          )}
        </div>
      </div>

      {sharing && (
        <ShareModal node={sharing} onClose={() => setSharing(null)} />
      )}
    </div>
  );
}

function ViewTab({
  active,
  onClick,
  Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof List;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={clsx(
        "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.15em] transition-colors duration-200",
        active
          ? "border-accent text-accent"
          : "border-transparent text-ink-subtle hover:text-ink"
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}
