import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import { Check, Copy, Loader2, ShieldCheck, X } from "lucide-react";

import { api } from "../../services/api";
import type { FsNode } from "../../types/fs";
import { getApiErrorMessage } from "../../utils/apiError";

type Props = {
  node: FsNode;
  onClose: () => void;
};

type CreatedShare = {
  grant_id: string;
  share_url: string;
  grantee_email: string | null;
};

type CreatedBatch = {
  file_name: string;
  expires_at: string | null;
  max_views: number | null;
  max_prints: number | null;
  allow_download: boolean;
  shares: CreatedShare[];
};

const inputCls =
  "w-full rounded-md border border-hairline bg-surface-1 px-3 py-2 text-sm text-ink placeholder:text-ink-dim transition-colors duration-200 focus:border-accent focus:outline-none";
const labelCls =
  "font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-subtle";

/** 백엔드 EMAIL_RE 와 같은 수준의 형식 검사. 도달 가능성은 확인하지 않는다. */
const EMAIL_RE = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;

export function ShareModal({ node, onClose }: Props) {
  const [emails, setEmails] = useState<string[]>([]);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  const [expiresInDays, setExpiresInDays] = useState("7");
  const [maxViews, setMaxViews] = useState("");
  const [maxPrints, setMaxPrints] = useState("0");
  const [allowDownload, setAllowDownload] = useState(false);

  const [created, setCreated] = useState<CreatedBatch | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) =>
      e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** 초안을 칩으로 확정. 성공하면 true. */
  function commitEmail(): boolean {
    const value = emailDraft.trim().toLowerCase();
    if (!value) return true;
    if (!EMAIL_RE.test(value)) {
      setEmailError("올바른 이메일 형식이 아닙니다.");
      return false;
    }
    if (emails.includes(value)) {
      setEmailDraft("");
      return true;
    }
    setEmails((prev) => [...prev, value]);
    setEmailDraft("");
    setEmailError(null);
    return true;
  }

  /**
   * Enter/쉼표/스페이스는 "수신자 추가"지 "제출"이 아니다.
   * 이걸 막지 않으면 이메일을 입력하다 엔터를 친 순간 링크가 발급된다.
   */
  function handleEmailKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      commitEmail();
      return;
    }
    if (e.key === "Backspace" && !emailDraft && emails.length > 0) {
      setEmails((prev) => prev.slice(0, -1));
    }
  }

  function removeEmail(target: string) {
    setEmails((prev) => prev.filter((e) => e !== target));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // 아직 칩이 되지 않은 초안도 수신자에 포함시킨다.
    if (!commitEmail()) return;
    const recipients = emailDraft.trim()
      ? [...emails, emailDraft.trim().toLowerCase()]
      : emails;

    setError(null);
    setLoading(true);
    try {
      const res = await api.post<CreatedBatch>("/shares", {
        node_id: node.node_id,
        grantee_emails: recipients,
        // 빈 값은 "제한 없음". max_prints 만 0 이 "인쇄 금지"라는 뜻을 갖는다.
        expires_in_days: expiresInDays === "" ? null : Number(expiresInDays),
        max_views: maxViews === "" ? null : Number(maxViews),
        max_prints: maxPrints === "" ? null : Number(maxPrints),
        allow_download: allowDownload,
      });
      setCreated(res.data);
    } catch (err) {
      setError(getApiErrorMessage(err, "공유 링크를 만들지 못했습니다."));
    } finally {
      setLoading(false);
    }
  }

  async function copyLink(share: CreatedShare) {
    await navigator.clipboard.writeText(share.share_url);
    setCopiedId(share.grant_id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const isRestricted = emails.length > 0 || emailDraft.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${node.name} 보호 공유`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-hairline bg-surface-1 p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-accent" aria-hidden />
              <h2 className="text-lg font-semibold tracking-tightest-3 text-ink">
                보호 공유
              </h2>
            </div>
            <p className="mt-1 truncate text-sm text-ink-muted">{node.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-ink-dim transition-colors duration-200 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {created ? (
          <div>
            <p className={labelCls}>
              Share links ({created.shares.length})
            </p>

            <ul className="mt-2 space-y-3">
              {created.shares.map((share) => (
                <li key={share.grant_id}>
                  <p className="mb-1 font-mono text-[11px] text-ink-subtle">
                    {share.grantee_email ?? "링크를 아는 누구나"}
                  </p>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={share.share_url}
                      onFocus={(e) => e.target.select()}
                      className="min-w-0 flex-1 rounded-md border border-hairline bg-surface-2 px-3 py-2 font-mono text-xs text-ink"
                    />
                    <button
                      type="button"
                      onClick={() => copyLink(share)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-xs font-medium text-canvas transition-colors duration-200 hover:bg-accent-hover"
                    >
                      {copiedId === share.grant_id ? (
                        <Check className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                      )}
                      {copiedId === share.grant_id ? "Copied" : "Copy"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <ul className="mt-4 space-y-1 font-mono text-[11px] text-ink-subtle">
              <li>
                만료:{" "}
                {created.expires_at
                  ? new Date(created.expires_at).toLocaleString()
                  : "없음"}
              </li>
              <li>열람: {created.max_views ?? "무제한"}</li>
              <li>
                인쇄:{" "}
                {created.max_prints === 0
                  ? "금지"
                  : (created.max_prints ?? "무제한")}
              </li>
              <li>원본 다운로드: {created.allow_download ? "허용" : "차단"}</li>
            </ul>

            <p className="mt-4 rounded-md border border-hairline bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-ink-dim">
              {created.shares.some((s) => s.grantee_email)
                ? "수신자를 지정한 링크는 해당 이메일로 castor에 로그인해야 열립니다. 다만 화면 캡처는 막을 수 없으므로 문서에는 수신자 정보가 워터마크로 새겨집니다."
                : "링크를 가진 사람은 로그인 없이 열람할 수 있습니다. 화면 캡처는 막을 수 없으므로, 문서에는 수신자 정보가 워터마크로 새겨집니다."}
            </p>

            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-md border border-hairline bg-surface-2 px-4 py-2.5 text-sm font-medium text-ink-muted transition-colors duration-200 hover:bg-surface-3 hover:text-ink"
            >
              닫기
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelCls} htmlFor="share-email">
                수신자 이메일 (선택)
              </label>

              {emails.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {emails.map((e) => (
                    <li key={e}>
                      <span className="inline-flex items-center gap-1.5 rounded-xs border border-accent/25 bg-accent/5 py-1 pl-2 pr-1 font-mono text-[11px] text-accent">
                        {e}
                        <button
                          type="button"
                          onClick={() => removeEmail(e)}
                          aria-label={`${e} 제거`}
                          className="rounded-xs p-0.5 transition-colors duration-200 hover:bg-accent/15"
                        >
                          <X className="h-3 w-3" aria-hidden />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <input
                id="share-email"
                type="text"
                inputMode="email"
                autoComplete="off"
                value={emailDraft}
                onChange={(e) => {
                  setEmailDraft(e.target.value);
                  setEmailError(null);
                }}
                onKeyDown={handleEmailKeyDown}
                onBlur={() => commitEmail()}
                placeholder="이메일 입력 후 Enter · 비우면 링크를 아는 누구나"
                className={`mt-2 ${inputCls}`}
              />

              {emailError ? (
                <p className="mt-1.5 text-[11px] text-rose-300">{emailError}</p>
              ) : (
                <p className="mt-1.5 text-[11px] text-ink-dim">
                  {isRestricted
                    ? "지정한 이메일로 castor에 로그인해야 열람할 수 있습니다. 수신자마다 링크가 따로 발급되어 개별 취소가 가능합니다."
                    : "비워두면 링크를 가진 누구나 로그인 없이 열람할 수 있습니다."}
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>만료(일)</label>
                <input
                  type="number"
                  min={1}
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  placeholder="무제한"
                  className={`mt-2 ${inputCls}`}
                />
              </div>
              <div>
                <label className={labelCls}>열람 횟수</label>
                <input
                  type="number"
                  min={1}
                  value={maxViews}
                  onChange={(e) => setMaxViews(e.target.value)}
                  placeholder="무제한"
                  className={`mt-2 ${inputCls}`}
                />
              </div>
              <div>
                <label className={labelCls}>인쇄 횟수</label>
                <input
                  type="number"
                  min={0}
                  value={maxPrints}
                  onChange={(e) => setMaxPrints(e.target.value)}
                  placeholder="무제한"
                  className={`mt-2 ${inputCls}`}
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-hairline bg-surface-2 px-3 py-2.5">
              <input
                type="checkbox"
                checked={allowDownload}
                onChange={(e) => setAllowDownload(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 accent-accent"
              />
              <span className="text-sm text-ink-muted">
                원본 다운로드 허용
                <span className="mt-0.5 block text-[11px] text-ink-dim">
                  켜면 수신자가 워터마크 없는 원본을 받을 수 있습니다.
                </span>
              </span>
            </label>

            {error && (
              <div className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm text-rose-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-canvas transition-colors duration-200 hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-dim"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {loading
                ? "만드는 중…"
                : emails.length > 1
                  ? `공유 링크 ${emails.length}개 만들기`
                  : "공유 링크 만들기"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
