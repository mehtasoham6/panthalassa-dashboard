import { BrowserRouter, Route, Routes } from "react-router";
import { WireframeHome } from "./pages/WireframeHome.js";
import { OldDashboard } from "./pages/OldDashboard.js";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<OldDashboard />} />
        <Route path="/old" element={<OldDashboard />} />
        <Route path="/landing" element={<WireframeHome />} />
      </Routes>
    </BrowserRouter>
  );
}
