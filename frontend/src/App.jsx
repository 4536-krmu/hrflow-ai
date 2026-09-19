import { Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "./pages/LoginPage.jsx";
import EmployeePage from "./pages/EmployeePage.jsx";
import HRDashboard from "./pages/HRDashboard.jsx";

function ProtectedRoute({ role, children }) {
  const currentRole = localStorage.getItem("hrflowRole");

  if (currentRole !== role) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function HomeRedirect() {
  const role = localStorage.getItem("hrflowRole");

  if (role === "employee") {
    return <Navigate to="/employee" replace />;
  }

  if (role === "hr") {
    return <Navigate to="/hr" replace />;
  }

  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>

      {/* Login page */}
      <Route
        path="/login"
        element={<LoginPage />}
      />

      {/* Employee */}
      <Route
        path="/employee"
        element={
          <ProtectedRoute role="employee">
            <EmployeePage />
          </ProtectedRoute>
        }
      />

      {/* HR */}
      <Route
        path="/hr"
        element={
          <ProtectedRoute role="hr">
            <HRDashboard />
          </ProtectedRoute>
        }
      />

      {/* Home */}
      <Route
        path="/"
        element={<HomeRedirect />}
      />

      {/* Unknown URL */}
      <Route
        path="*"
        element={<HomeRedirect />}
      />

    </Routes>
  );
}