import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { WireframeHome } from "./pages/WireframeHome.js";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WireframeHome />} />
        <Route path="/old" element={<Navigate to="/#dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
