import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "sonner";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import CreateRecap from "@/pages/CreateRecap";
import RecapDetail from "@/pages/RecapDetail";
import ClauseLibrary from "@/pages/ClauseLibrary";
import ClauseDetail from "@/pages/ClauseDetail";
import ClauseCompare from "@/pages/ClauseCompare";
import Alerts from "@/pages/Alerts";
import Noticeboard from "@/pages/Noticeboard";
import Audit from "@/pages/Audit";
import Layout from "@/components/Layout";

function Protected({ children }) {
    const { user, loading } = useAuth();
    if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-zinc-500">Loading...</div>;
    if (!user) return <Navigate to="/login" replace />;
    return <Layout>{children}</Layout>;
}

function AuthRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (user) return <Navigate to="/" replace />;
    return children;
}

function App() {
    return (
        <div className="App">
            <AuthProvider>
                <BrowserRouter>
                    <Toaster position="top-right" richColors />
                    <Routes>
                        <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
                        <Route path="/register" element={<AuthRoute><Register /></AuthRoute>} />
                        <Route path="/" element={<Protected><Dashboard /></Protected>} />
                        <Route path="/recaps/new" element={<Protected><CreateRecap /></Protected>} />
                        <Route path="/parser" element={<Protected><CreateRecap /></Protected>} />
                        <Route path="/recaps/:id" element={<Protected><RecapDetail /></Protected>} />
                        <Route path="/clauses" element={<Protected><ClauseLibrary /></Protected>} />
                        <Route path="/clauses/compare" element={<Protected><ClauseCompare /></Protected>} />
                        <Route path="/clauses/:id" element={<Protected><ClauseDetail /></Protected>} />
                        <Route path="/alerts" element={<Protected><Alerts /></Protected>} />
                        <Route path="/noticeboard" element={<Protected><Noticeboard /></Protected>} />
                        <Route path="/audit" element={<Protected><Audit /></Protected>} />
                    </Routes>
                </BrowserRouter>
            </AuthProvider>
        </div>
    );
}

export default App;
