import { Loader2 } from "lucide-react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function ProtectedRoute() {
  const { state } = useAuth();
  const location = useLocation();

  if (state === "loading") {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas" role="status">
        <Loader2 className="size-6 animate-spin text-ink" />
        <span className="sr-only">Checking your session</span>
      </div>
    );
  }
  if (state === "anonymous") {
    // Keep the query too, so a filtered list link comes back filtered after signing in.
    return <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search + location.hash }} />;
  }
  return <Outlet />;
}
