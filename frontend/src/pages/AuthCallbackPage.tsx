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
      setError("code 또는 state 누락");
      return;
    }

    (async () => {
      try {
        const tokens = await oauth.exchangeCodeForTokens(code, state);
        await setSession(tokens);
        navigate("/app", { replace: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : "로그인 처리 실패");
      }
    })();
  }, [params, navigate, setSession]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        {error ? (
          <>
            <p className="text-rose-600">{error}</p>
            <button
              onClick={() => navigate("/login")}
              className="mt-4 text-sm text-indigo-600 hover:text-indigo-700"
            >
              로그인 페이지로 돌아가기
            </button>
          </>
        ) : (
          <p className="text-slate-500">로그인 처리 중…</p>
        )}
      </div>
    </div>
  );
}
