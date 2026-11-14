import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from "react-router-dom";
import { useEffect } from "react";
import { AppShell } from "./components/AppShell.tsx";
import { DashboardPage } from "./pages/DashboardPage.tsx";
import { AssetDetailPage } from "./pages/AssetDetailPage.tsx";
import { AssetsPage } from "./pages/AssetsPage.tsx";
import { LoginPage } from "./pages/LoginPage.tsx";
import { OperationsPage } from "./pages/OperationsPage.tsx";
import { ReportsPage } from "./pages/ReportsPage.tsx";
import { AuthProvider, useAuth } from "./lib/auth-context.tsx";
import { getCurrentUser } from "./lib/api.ts";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
    },
  },
});

function RequireAuth() {
  const { session, clearSession } = useAuth();
  const currentUser = useQuery({
    queryKey: ["auth", "me", session?.user.id],
    queryFn: getCurrentUser,
    enabled: Boolean(session),
    retry: false,
    staleTime: 30_000,
  });
  useEffect(() => {
    if (currentUser.isError) clearSession();
  }, [clearSession, currentUser.isError]);

  if (!session) return <Navigate to="/login" replace />;
  if (currentUser.isPending) {
    return (
      <div className="auth-loading" role="status">
        Verifying session…
      </div>
    );
  }
  if (currentUser.isError) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function LoginRoute() {
  const { session } = useAuth();
  return session ? <Navigate to="/dashboard" replace /> : <LoginPage />;
}

const router = createBrowserRouter([
  { path: "/login", element: <LoginRoute /> },
  {
    path: "/",
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: "dashboard", element: <DashboardPage /> },
          { path: "assets", element: <AssetsPage /> },
          { path: "assets/:id", element: <AssetDetailPage /> },
          { path: "operations", element: <OperationsPage /> },
          { path: "reports", element: <ReportsPage /> },
        ],
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
