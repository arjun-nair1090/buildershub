import { Loader2 } from "lucide-react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function ProtectedRoute() {
  const { state } = useAuth();
  const location = useLocation();

  if (state === "loading") {
    return (
      <div className="grid min-h-dvh place-items-center bg-chalk" role="status">
        <Loader2 className="size-6 animate-spin text-basalt" />
        <span className="sr-only">Checking your session</span>
      </div>
    );
  }
  if (state === "anonymous") {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
