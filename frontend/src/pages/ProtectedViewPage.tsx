import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, Loader2, Lock, Printer, ShieldAlert } from "lucide-react";

import { PdfCanvas } from "../components/viewer/PdfCanvas";
import { Watermark } from "../components/viewer/Watermark";
import { decodeEpf, importCek, type EpfHeader } from "../epf/decode";
import { publicApi } from "../services/api";
import { getApiErrorMessage } from "../utils/apiError";

type Policy = {
  file_name: string;
  mime_type: string | null;
  size_bytes: number;
  expires_at: string | null;
  allow_download: boolean;
  grantee_email: string | null;
  views_remaining: number;
  prints_remaining: number;
};

export function ProtectedViewPage() {
  const { token = "" } = useParams();

  const [policy, setPolicy] = useState<Policy | null>(null);
  const [header, setHeader] = useState<EpfHeader | null>(null);
  const [payload, setPayload] = useState<ArrayBuffer | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [printNote, setPrintNote] = useState<string | null>(null);
  const [openedAt] = useState(() => new Date().toLocaleString());

  // StrictMode 의 이중 실행으로 열람 횟수가 2회 차감되는 것을 막는다.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      try {
        // 1) 정책 확인 + CEK 수령 (여기서 열람 1회가 소비된다)
        const pol = await publicApi.get("/access/policy", { params: { token } });
        setPolicy(pol.data.policy);
        const cek = await importCek(pol.data.cek);

        // 2) .epf 내려받아 브라우저에서 복호화
        const enc = await publicApi.get("/access/content", {
          params: { token },
          responseType: "arraybuffer",
        });
        const { header: hdr, payload: plain } = await decodeEpf(enc.data, cek);

        setHeader(hdr);
        setPayload(plain);
        if ((hdr.meta.mime ?? "").startsWith("image/")) {
          setImageUrl(
            URL.createObjectURL(new Blob([plain], { type: hdr.meta.mime! }))
          );
        }
      } catch (e) {
        setError(getApiErrorMessage(e, "문서를 열 수 없습니다."));
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // 이미지 blob URL 정리
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  // 선택/우클릭 억제 — 우회 가능한 억지책이지 보안 경계가 아니다.
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", block);
    document.addEventListener("copy", block);
    return () => {
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("copy", block);
    };
  }, []);

  const handlePrint = useCallback(async () => {
    setPrintNote(null);
    try {
      const res = await publicApi.post("/access/print", { token });
      const left = res.data.prints_remaining;
      setPrintNote(
        left < 0 ? "인쇄를 시작합니다." : `인쇄를 시작합니다. ${left}회 남음.`
      );
      window.print();
    } catch (e) {
      setPrintNote(getApiErrorMessage(e, "인쇄할 수 없습니다."));
    }
  }, [token]);

  function handleDownload() {
    const base = publicApi.defaults.baseURL ?? "";
    window.open(`${base}/access/download?token=${encodeURIComponent(token)}`, "_blank");
  }

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center gap-2 py-24 text-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span className="text-sm">문서를 복호화하는 중…</span>
        </div>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <div className="mx-auto max-w-md py-20 text-center">
          <ShieldAlert
            className="mx-auto mb-4 h-12 w-12 text-rose-400"
            strokeWidth={1.25}
            aria-hidden
          />
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-rose-300">
            Access denied
          </p>
          <p className="mt-3 text-sm text-ink-muted">{error}</p>
          <Link
            to="/"
            className="mt-6 inline-block text-sm text-accent transition-colors duration-200 hover:text-accent-hover"
          >
            castor 홈으로
          </Link>
        </div>
      </Shell>
    );
  }

  const watermarkLabel = policy?.grantee_email || "link recipient";
  const isPdf = (header?.meta.mime ?? "") === "application/pdf";
  const canPrint = !policy || policy.prints_remaining !== 0;

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-1 px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
            <p className="truncate text-sm font-medium text-ink">
              {policy?.file_name}
            </p>
          </div>
          <p className="mt-1 font-mono text-[11px] text-ink-subtle">
            {policy?.views_remaining === -1
              ? "열람 무제한"
              : `열람 ${policy?.views_remaining}회 남음`}
            {policy?.expires_at &&
              ` · ${new Date(policy.expires_at).toLocaleDateString()} 만료`}
          </p>
        </div>

        <div className="flex shrink-0 gap-2 print:hidden">
          {canPrint && (
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors duration-200 hover:bg-surface-3 hover:text-ink"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden />
              Print
            </button>
          )}
          {policy?.allow_download && (
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-canvas transition-colors duration-200 hover:bg-accent-hover"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Download
            </button>
          )}
        </div>
      </div>

      {printNote && (
        <p className="mb-4 rounded-md border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink-muted print:hidden">
          {printNote}
        </p>
      )}

      {/* 워터마크가 항상 콘텐츠 위에 오도록 같은 스태킹 컨텍스트에 둔다 */}
      <div className="relative select-none rounded-xl bg-white p-4">
        {isPdf && payload ? (
          <PdfCanvas
            data={payload}
            onError={setError}
            onLoaded={() => undefined}
          />
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={policy?.file_name ?? ""}
            draggable={false}
            className="mx-auto block max-w-full"
          />
        ) : (
          <p className="py-16 text-center text-sm text-neutral-600">
            이 형식은 보호 뷰어에서 표시할 수 없습니다.
          </p>
        )}
        <Watermark label={watermarkLabel} openedAt={openedAt} />
      </div>

      <p className="mt-6 text-center font-mono text-[11px] text-ink-dim print:hidden">
        이 문서는 {watermarkLabel} 에게 발급되었습니다. 무단 배포 시 추적될 수
        있습니다.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8 flex items-center gap-3 print:hidden">
          <Link to="/" className="text-lg font-semibold tracking-tightest-3 text-ink">
            castor
          </Link>
          <span className="rounded-xs border border-hairline bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-accent">
            protected view
          </span>
        </header>
        {children}
      </div>
    </div>
  );
}
