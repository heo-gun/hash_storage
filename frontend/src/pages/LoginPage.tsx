import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { signInWithPassword, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo =
    (location.state as { from?: string } | null)?.from || "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithPassword(email.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    }
  }

  const inputCls =
    "mt-2 w-full rounded-md border border-hairline bg-surface-1 px-3 py-2 text-sm text-ink placeholder:text-ink-dim transition-colors duration-200 focus:border-accent focus:outline-none";

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* Hash watermark */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 select-none overflow-hidden opacity-[0.03] font-mono text-[140px] leading-none text-ink whitespace-nowrap"
      >
        <div className="-rotate-[8deg] translate-y-32 translate-x-12">
          7a3f8b2e1d9c4f5a6b8c0d1e2f3a4b5c6d7e8f9a
        </div>
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-10 flex items-center justify-center gap-3">
            <span className="text-2xl font-semibold tracking-tightest-3 text-ink">
              castor
            </span>
            <span className="font-mono text-[11px] text-accent bg-surface-2 px-2 py-0.5 rounded-xs border border-hairline">
              sha256:7a3f8b…
            </span>
          </Link>

          <div className="rounded-2xl border border-hairline bg-surface-1 p-8">
            <h1 className="text-2xl font-semibold tracking-tightest-3 text-ink">
              Welcome back
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              Sign in to continue to castor.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-subtle">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-subtle">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputCls}
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm text-rose-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-canvas transition-colors duration-200 hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-dim"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-ink-dim">
              <div className="h-px flex-1 bg-hairline" />
              <span className="font-mono">or</span>
              <div className="h-px flex-1 bg-hairline" />
            </div>

            <button
              onClick={handleGoogle}
              className="flex w-full items-center justify-center gap-3 rounded-md border border-hairline bg-surface-2 px-4 py-2.5 text-sm font-medium text-ink transition-colors duration-200 hover:bg-surface-3"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
                />
              </svg>
              Continue with Google
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-ink-muted">
            Don't have an account?{" "}
            <Link
              to="/signup"
              className="font-medium text-accent transition-colors duration-200 hover:text-accent-hover"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
