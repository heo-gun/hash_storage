import { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppPage } from "./pages/AppPage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { SearchPage } from "./pages/SearchPage";
import { SignupPage } from "./pages/SignupPage";

// 보호 뷰어는 PDF.js(약 1MB)를 끌고 온다. 링크를 받은 수신자만 쓰는 화면이므로
// 메인 번들에서 떼어내 해당 라우트에 들어올 때만 받도록 한다.
const ProtectedViewPage = lazy(() =>
  import("./pages/ProtectedViewPage").then((m) => ({
    default: m.ProtectedViewPage,
  }))
);

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-subtle">
          Loading viewer
        </span>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          {/* 공개 검색 — 비로그인 방문자도 접근 가능 */}
          <Route path="/search" element={<SearchPage />} />
          <Route
            path="/app/*"
            element={
              <ProtectedRoute>
                <AppPage />
              </ProtectedRoute>
            }
          />
          {/* 보호 뷰어 — 비회원 수신자도 링크 토큰만으로 접근 */}
          <Route
            path="/view/:token"
            element={
              <Suspense fallback={<RouteFallback />}>
                <ProtectedViewPage />
              </Suspense>
            }
          />
          {/* TODO Phase 2: /settings */}
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
