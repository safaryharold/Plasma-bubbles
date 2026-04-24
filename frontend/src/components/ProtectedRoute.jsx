import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, requireRole }) {
  const { user, loading } = useAuth();
  if (loading || user === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#090A0C] text-[#8B93A5] mono text-xs uppercase tracking-widest">
        Initialising command center...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (requireRole && requireRole.length && !requireRole.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
