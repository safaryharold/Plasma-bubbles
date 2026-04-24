import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Calculator from "./pages/Calculator";
import Sweep from "./pages/Sweep";
import Experiments from "./pages/Experiments";
import Compare from "./pages/Compare";
import ApiKeys from "./pages/ApiKeys";
import Admin from "./pages/Admin";
import WorldMap from "./pages/WorldMap";
import PublicShare from "./pages/PublicShare";
import { Toaster } from "sonner";

function LandingOrRedirect() {
  const { user, loading } = useAuth();
  if (loading || user === null) {
    return <div className="min-h-screen bg-[#090A0C]" />;
  }
  if (user) return <Navigate to="/dashboard" replace />;
  return <Landing />;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingOrRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
            <Route path="/calculator" element={<ProtectedRoute><Layout><Calculator /></Layout></ProtectedRoute>} />
            <Route path="/sweep" element={<ProtectedRoute><Layout><Sweep /></Layout></ProtectedRoute>} />
            <Route path="/experiments" element={<ProtectedRoute><Layout><Experiments /></Layout></ProtectedRoute>} />
            <Route path="/compare" element={<ProtectedRoute><Layout><Compare /></Layout></ProtectedRoute>} />
            <Route path="/worldmap" element={<ProtectedRoute><Layout><WorldMap /></Layout></ProtectedRoute>} />
            <Route path="/keys" element={<ProtectedRoute><Layout><ApiKeys /></Layout></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute requireRole={["admin"]}><Layout><Admin /></Layout></ProtectedRoute>} />
            <Route path="/s/:token" element={<PublicShare />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster theme="dark" position="top-right" />
      </AuthProvider>
    </div>
  );
}

export default App;
