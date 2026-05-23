import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import * as oauth from "../auth/oauth";

export function AuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = params.get("code");
    const state = params.get("state");
    const errParam = params.get("error_description") || params.get("error");

    if (errParam) {
      setError(errParam);
      return;
    }
    if (!code || !state) {
      setError("Missing code or state");
      return;
    }

    (async () => {
      try {
        const tokens = await oauth.exchangeCodeForTokens(code, state);
        await setSession(tokens);
        navigate("/app", { replace: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sign-in failed");
      }
    })();
  }, [params, navigate, setSession]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-6">
      <div className="text-center">
        {error ? (
          <>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-rose-300">
              Sign-in error
            </p>
            <p className="mt-3 max-w-md text-sm text-ink-muted">{error}</p>
            <button
              onClick={() => navigate("/login")}
              className="mt-6 text-sm text-accent transition-colors duration-200 hover:text-accent-hover"
            >
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-subtle">
                Signing in
              </span>
            </div>
            <p className="text-sm text-ink-muted">
              Exchanging authorization code…
            </p>
          </>
        )}
      </div>
    </div>
  );
}
