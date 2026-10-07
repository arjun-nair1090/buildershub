import { Loader2 } from "lucide-react";
import { lazy, Suspense, type ComponentType } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { AuthProvider } from "@/hooks/useAuth";
import { LandingPage } from "@/pages/LandingPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { VerifyLookupPage } from "@/pages/VerifyLookupPage";
import { VerifyPage } from "@/pages/VerifyPage";

// Admin screens are split out so buyers opening a QR link on a phone only download the public pages.
const named = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));

const ProtectedRoute = named(() => import("@/components/layout/ProtectedRoute"), "ProtectedRoute");
const AdminLayout = named(() => import("@/components/layout/AdminLayout"), "AdminLayout");
const LoginPage = named(() => import("@/pages/admin/LoginPage"), "LoginPage");
const DashboardPage = named(() => import("@/pages/admin/DashboardPage"), "DashboardPage");
const JewelleryListPage = named(() => import("@/pages/admin/JewelleryListPage"), "JewelleryListPage");
const AddJewelleryPage = named(() => import("@/pages/admin/AddJewelleryPage"), "AddJewelleryPage");
const JewelleryDetailPage = named(() => import("@/pages/admin/JewelleryDetailPage"), "JewelleryDetailPage");
const EditJewelleryPage = named(() => import("@/pages/admin/EditJewelleryPage"), "EditJewelleryPage");

function PageLoader() {
  return (
    <div className="grid min-h-dvh place-items-center bg-ivory" role="status">
      <Loader2 className="size-6 animate-spin text-emerald" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route index element={<LandingPage />} />
              <Route path="verify" element={<VerifyLookupPage />} />
              <Route path="verify/:token" element={<VerifyPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            <Route path="admin/login" element={<LoginPage />} />
            <Route path="admin" element={<ProtectedRoute />}>
              <Route element={<AdminLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="jewellery" element={<JewelleryListPage />} />
                <Route path="jewellery/new" element={<AddJewelleryPage />} />
                <Route path="jewellery/:id" element={<JewelleryDetailPage />} />
                <Route path="jewellery/:id/edit" element={<EditJewelleryPage />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
      <Toaster
        position="top-center"
        toastOptions={{
          classNames: {
            toast: "!rounded-md !border !border-line !bg-white !font-sans !text-charcoal !shadow-[0_10px_30px_-12px_rgba(36,49,46,0.3)]",
            success: "[&_[data-icon]]:!text-emerald",
            error: "[&_[data-icon]]:!text-danger",
          },
        }}
      />
    </BrowserRouter>
  );
}
