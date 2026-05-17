import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { AppPage } from "./pages/AppPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app/*" element={<AppPage />} />
        {/* TODO Phase 2: /login (Cognito callback) */}
        {/* TODO Phase 3: /view/:token (.epf viewer) */}
        {/* TODO Phase 2: /settings */}
      </Routes>
    </BrowserRouter>
  );
}
