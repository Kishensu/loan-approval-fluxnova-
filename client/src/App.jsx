import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ApplyPage from "./pages/ApplyPage";
import StatusPage from "./pages/StatusPage";
import ManagerPage from "./pages/ManagerPage";
import OpsPage from "./pages/OpsPage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect root to apply */}
        <Route path="/" element={<Navigate to="/apply" replace />} />

        {/* Applicant: submit a loan application */}
        <Route path="/apply" element={<ApplyPage />} />

        {/* Applicant: check status of their application */}
        <Route path="/status/:instanceId" element={<StatusPage />} />

        {/* Manager: review pending loan applications */}
        <Route path="/manager" element={<ManagerPage />} />

        {/* Ops: manager dashboard with stats and history */}
        <Route path="/ops" element={<OpsPage />} />

        {/* Catch-all */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}