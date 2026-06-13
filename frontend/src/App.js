import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import FamilyLogin from "./pages/FamilyLogin";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Families from "./pages/Families";
import FamilyDetail from "./pages/FamilyDetail";
import AidRecords from "./pages/AidRecords";
import AidTypes from "./pages/AidTypes";
import Settings from "./pages/Settings";
import IndividualMembers from "./pages/IndividualMembers";
import Categories from "./pages/Categories";
import CategoryRecords from "./pages/CategoryRecords";
import FamilyPortal from "./pages/FamilyPortal";
import { Loader2 } from "lucide-react";

function Protected({ children, adminOnly }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/family-login" element={<FamilyLogin />} />
      <Route path="/family-portal" element={<FamilyPortal />} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="families" element={<Families />} />
        <Route path="families/:id" element={<FamilyDetail />} />
        <Route path="individual-members" element={<IndividualMembers />} />
        <Route path="categories" element={<Categories />} />
        <Route path="categories/:id" element={<CategoryRecords />} />
        <Route path="aid-records" element={<AidRecords />} />
        <Route
          path="aid-types"
          element={
            <Protected adminOnly>
              <AidTypes />
            </Protected>
          }
        />
        <Route
          path="settings"
          element={
            <Protected adminOnly>
              <Settings />
            </Protected>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        <Toaster richColors position="top-center" dir="rtl" />
      </AuthProvider>
    </div>
  );
}

export default App;
