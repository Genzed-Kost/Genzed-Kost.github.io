import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ requireRole }: { requireRole?: "admin" | "penghuni" }) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100svh" }}>
        <div className="spinner" style={{ borderTopColor: "var(--accent)", borderColor: "var(--border)" }} />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/penghuni/login" replace />;
  }

  if (requireRole && profile?.role !== requireRole) {
    return <Navigate to="/penghuni/dashboard" replace />;
  }

  return <Outlet />;
}
