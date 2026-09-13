import { BrowserRouter, Route, Routes } from "react-router";
import { WireframeHome } from "./pages/WireframeHome.js";
import { OldDashboard } from "./pages/OldDashboard.js";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WireframeHome />} />
        <Route path="/old" element={<OldDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
