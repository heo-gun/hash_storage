import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import * as cognito from "../auth/cognito";

type Stage = "form" | "confirm";

export function SignupPage() {
  const { signInWithPassword } = useAuth();
  const navigate = useNavigate();

  const [stage, setStage] = useState<Stage>("form");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await cognito.signUp(email.trim(), password, name.trim());
      setStage("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await cognito.confirmSignUp(email.trim(), code.trim());
      await signInWithPassword(email.trim(), password);
      navigate("/app", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify that code");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    setInfo(null);
    try {
      await cognito.resendConfirmationCode(email.trim());
      setInfo("A new code has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the code");
    }
  }

  const inputCls =
    "mt-2 w-full rounded-md border border-hairline bg-surface-1 px-3 py-2 text-sm text-ink placeholder:text-ink-dim transition-colors duration-200 focus:border-accent focus:outline-none";
  const labelCls =
    "font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-subtle";

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 select-none overflow-hidden opacity-[0.03] font-mono text-[140px] leading-none text-ink whitespace-nowrap"
      >
        <div className="-rotate-[8deg] translate-y-32 translate-x-12">
          b2f04ca1e8d77361029384756afcde012345678901234567890abcdef1234567
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
              {stage === "form" ? "Create account" : "Verify email"}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              {stage === "form"
                ? "Start storing files identified by hash."
                : `Enter the 6-digit code sent to ${email}.`}
            </p>

            {stage === "form" ? (
              <form onSubmit={handleSignup} className="mt-6 space-y-4">
                <div>
                  <label className={labelCls}>Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputCls}
                  />
                  <p className="mt-1.5 font-mono text-[11px] text-ink-dim">
                    8+ chars, mixed case, number, symbol
                  </p>
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
                  {loading ? "Creating…" : "Create account"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleConfirm} className="mt-6 space-y-4">
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="000000"
                  className="w-full rounded-md border border-hairline bg-surface-1 px-3 py-3 text-center font-mono text-xl tracking-[0.4em] text-ink placeholder:text-ink-dim focus:border-accent focus:outline-none"
                />

                {error && (
                  <div className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm text-rose-300">
                    {error}
                  </div>
                )}
                {info && (
                  <div className="rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-sm text-accent">
                    {info}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-canvas transition-colors duration-200 hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-dim"
                >
                  {loading ? "Verifying…" : "Verify"}
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  className="w-full text-sm text-ink-muted transition-colors duration-200 hover:text-ink"
                >
                  Resend code
                </button>
              </form>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-ink-muted">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium text-accent transition-colors duration-200 hover:text-accent-hover"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
