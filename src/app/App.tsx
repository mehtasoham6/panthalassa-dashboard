import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { WireframeHome } from "./pages/WireframeHome.js";
import { OldDashboard } from "./pages/OldDashboard.js";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WireframeHome />} />
        <Route path="/model" element={<OldDashboard />} />
        {/* The dashboard used to live at /old; keep inbound links working. */}
        <Route path="/old" element={<Navigate to="/model" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
