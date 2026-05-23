import { useFileManager } from "../hooks/useFileManager";
import { AppHeader } from "../components/file-manager/AppHeader";
import { LocationSection } from "../components/file-manager/LocationSection";
import { FolderCreateCard } from "../components/file-manager/FolderCreateCard";
import { UploadCard } from "../components/file-manager/UploadCard";
import { BannerAlert } from "../components/file-manager/BannerAlert";
import { NodeListTable } from "../components/file-manager/NodeListTable";

export function AppPage() {
  const fm = useFileManager();

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
              selectedFile={fm.selectedFile}
              loading={fm.loading}
              onFileChange={fm.setSelectedFile}
              onUpload={fm.handleUpload}
            />
          </div>

          <BannerAlert banner={fm.banner} />

          <NodeListTable
            nodes={fm.nodes}
            loading={fm.loading}
            folderCount={fm.folderCount}
            fileCount={fm.fileCount}
            onOpenFolder={fm.openFolder}
            onDownload={fm.handleDownload}
            onDelete={fm.handleDelete}
          />
        </div>
      </div>
    </div>
  );
}
