import { useFileManager } from "../hooks/useFileManager";
import { AppHeader } from "../components/file-manager/AppHeader";
import { LocationSection } from "../components/file-manager/LocationSection";
import { FolderCreateCard } from "../components/file-manager/FolderCreateCard";
import { UploadCard } from "../components/file-manager/UploadCard";
import { BannerAlert } from "../components/file-manager/BannerAlert";
import { NodeListTable } from "../components/file-manager/NodeListTable";

/**
 * 파일 매니저 페이지 (/app)
 * 기존 단일 페이지 앱의 UI를 그대로 옮긴 것.
 * Phase 2에서 Cognito 로그인 가드 추가 예정.
 */
export function AppPage() {
  const fm = useFileManager();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50/80">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <AppHeader />

        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/50">
          <LocationSection
            breadcrumbs={fm.breadcrumbs}
            currentPath={fm.currentPath}
            onNavigateCrumb={fm.moveToBreadCrumb}
          />

          <div className="grid gap-4 border-b border-slate-100 p-5 sm:p-6 md:grid-cols-2">
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
