import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Download, Globe, Loader2, SearchX } from "lucide-react";

import { useAuth } from "../auth/AuthContext";
import { publicApi } from "../services/api";
import type { PublicSearchResponse, PublicSearchResult } from "../types/fs";
import { formatFileSize } from "../utils/format";

const PAGE_SIZE = 30;

export function SearchPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";

  const [draft, setDraft] = useState(q);
  const [results, setResults] = useState<PublicSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 검색어가 URL 에 있으므로 뒤로가기/공유가 그대로 동작한다.
  const latest = useRef(0);

  useEffect(() => {
    setDraft(q);
    const reqId = ++latest.current;
    setLoading(true);
    setError(null);

    publicApi
      .get<PublicSearchResponse>("/search", {
        params: { q, limit: PAGE_SIZE },
      })
      .then((res) => {
        // 타이핑이 빠를 때 늦게 도착한 응답이 최신 결과를 덮지 않도록
        if (reqId !== latest.current) return;
        setResults(res.data.results);
        setTotal(res.data.total);
      })
      .catch((e) => {
        if (reqId !== latest.current) return;
        console.error(e);
        setError("검색에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      })
      .finally(() => {
        if (reqId === latest.current) setLoading(false);
      });
  }, [q]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setParams(draft.trim() ? { q: draft.trim() } : {}, { replace: false });
  }

  function download(node: PublicSearchResult) {
    const base = publicApi.defaults.baseURL ?? "";
    window.open(`${base}/public/nodes/${node.node_id}/download`, "_blank");
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 select-none overflow-hidden opacity-[0.025] font-mono text-[140px] leading-none text-ink whitespace-nowrap"
      >
        <div className="-rotate-[8deg] translate-y-32 translate-x-12">
          7a3f8b2e1d9c4f5a6b8c0d1e2f3a4b5c6d7e8f9a
        </div>
      </div>

      <div className="relative mx-auto max-w-4xl px-6 py-12">
        <header className="mb-10 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            <span className="text-xl font-semibold tracking-tightest-3 text-ink">
              castor
            </span>
            <span className="rounded-xs border border-hairline bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-accent">
              search
            </span>
          </Link>
          <Link
            to={user ? "/app" : "/login"}
            className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-muted transition-colors duration-200 hover:text-ink"
          >
            {user ? "My files" : "Sign in"}
          </Link>
        </header>

        <h1 className="text-3xl font-semibold tracking-tightest-3 text-ink">
          Public files
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          공개(public)로 설정된 파일만 여기에 나타납니다. 로그인 없이 내려받을 수
          있습니다.
        </p>

        <form onSubmit={submit} className="mt-6 flex gap-2">
          <input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="파일 이름으로 검색"
            className="flex-1 rounded-md border border-hairline bg-surface-1 px-3 py-2.5 text-sm text-ink placeholder:text-ink-dim transition-colors duration-200 focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-canvas transition-colors duration-200 hover:bg-accent-hover"
          >
            Search
          </button>
        </form>

        <div className="mt-8">
          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-md border border-dashed border-hairline bg-surface-2/30 py-16 text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              <span className="text-sm">검색 중…</span>
            </div>
          ) : error ? (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-sm text-rose-300">
              {error}
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-hairline bg-surface-2/30 py-16 text-center">
              <SearchX
                className="mb-3 h-10 w-10 text-ink-dim"
                strokeWidth={1.25}
                aria-hidden
              />
              <p className="text-sm font-medium text-ink-muted">
                {q ? "일치하는 공개 파일이 없습니다" : "공개된 파일이 없습니다"}
              </p>
            </div>
          ) : (
            <>
              <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-subtle">
                {total} result{total === 1 ? "" : "s"}
                {total > results.length && ` · showing ${results.length}`}
              </p>
              <ul className="divide-y divide-hairline overflow-hidden rounded-md border border-hairline">
                {results.map((r) => (
                  <li
                    key={r.node_id}
                    className="flex items-center gap-3 bg-surface-1 px-4 py-3 transition-colors duration-150 hover:bg-surface-2/50"
                  >
                    <Globe
                      className="h-4 w-4 shrink-0 text-accent"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {r.name}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-ink-subtle">
                        {r.owner_name ?? "unknown"} ·{" "}
                        {formatFileSize(r.size_bytes)} ·{" "}
                        {new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => download(r)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-hairline bg-surface-2 px-3 py-1 text-xs font-medium text-ink-muted transition-colors duration-200 hover:bg-surface-3 hover:text-ink"
                    >
                      <Download className="h-3 w-3" aria-hidden />
                      Download
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
