import React, { Suspense, lazy } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import { PageLoader } from "./components/Skeleton";
import { Toaster } from "sonner";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";

// Lazy loaded (code splitting — only fetched when the route is visited)
const Calculator  = lazy(() => import("./pages/Calculator"));
const Sweep       = lazy(() => import("./pages/Sweep"));
const Experiments = lazy(() => import("./pages/Experiments"));
const Compare     = lazy(() => import("./pages/Compare"));
const ApiKeys     = lazy(() => import("./pages/ApiKeys"));
const Admin       = lazy(() => import("./pages/Admin"));
const WorldMap    = lazy(() => import("./pages/WorldMap"));
const Butterfly   = lazy(() => import("./pages/Butterfly"));
const PublicShare = lazy(() => import("./pages/PublicShare"));

function LandingOrRedirect() {
  const { user, loading } = useAuth();
  if (loading || user === null) {
    return <PageLoader label="Authenticating…" />;
  }
  if (user) return <Navigate to="/dashboard" replace />;
  return <Landing />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader label="Loading page…" />}>
              <Routes>
                <Route path="/"          element={<LandingOrRedirect />} />
                <Route path="/login"     element={<Login />} />
                <Route path="/register"  element={<Register />} />

                <Route path="/dashboard"  element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
                <Route path="/calculator" element={<ProtectedRoute><Layout><Calculator /></Layout></ProtectedRoute>} />
                <Route path="/sweep"      element={<ProtectedRoute><Layout><Sweep /></Layout></ProtectedRoute>} />
                <Route path="/experiments"element={<ProtectedRoute><Layout><Experiments /></Layout></ProtectedRoute>} />
                <Route path="/compare"    element={<ProtectedRoute><Layout><Compare /></Layout></ProtectedRoute>} />
                <Route path="/worldmap"   element={<ProtectedRoute><Layout><WorldMap /></Layout></ProtectedRoute>} />
                <Route path="/butterfly"  element={<ProtectedRoute><Layout><Butterfly /></Layout></ProtectedRoute>} />
                <Route path="/keys"       element={<ProtectedRoute><Layout><ApiKeys /></Layout></ProtectedRoute>} />
                <Route path="/admin"      element={<ProtectedRoute requireRole={["admin"]}><Layout><Admin /></Layout></ProtectedRoute>} />
                <Route path="/s/:token"   element={<PublicShare />} />
                <Route path="*"           element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <Toaster theme="dark" position="top-right" />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
