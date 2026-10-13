import { Loader2 } from "lucide-react";
import { lazy, Suspense, useLayoutEffect, type ComponentType } from "react";
import { BrowserRouter, Route, Routes, useLocation, useNavigationType } from "react-router-dom";
import { Toaster } from "sonner";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { AuthProvider } from "@/hooks/useAuth";
import { DesignPage } from "@/pages/DesignPage";
import { FeedPage } from "@/pages/FeedPage";
import { LandingPage } from "@/pages/LandingPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PrivacyPage } from "@/pages/PrivacyPage";
import { SearchPage } from "@/pages/SearchPage";
import { StorePage } from "@/pages/StorePage";
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
const TeamPage = named(() => import("@/pages/admin/TeamPage"), "TeamPage");
const SettingsPage = named(() => import("@/pages/admin/SettingsPage"), "SettingsPage");
const StoreListPage = named(() => import("@/pages/admin/StoreListPage"), "StoreListPage");
const StoreFormPage = named(() => import("@/pages/admin/StoreFormPage"), "StoreFormPage");
const DesignListPage = named(() => import("@/pages/admin/DesignListPage"), "DesignListPage");
const DesignFormPage = named(() => import("@/pages/admin/DesignFormPage"), "DesignFormPage");

function PageLoader() {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas" role="status">
      <Loader2 className="size-6 animate-spin text-ink" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

/** A new page opens at the top. Back and Forward leave the position to the browser, and so do filter changes, which keep the path. */
function ScrollToTop() {
  const { pathname } = useLocation();
  const navigation = useNavigationType();
  useLayoutEffect(() => {
    if (navigation !== "POP") window.scrollTo(0, 0);
    // Only a new path scrolls: reading the navigation type mustn't make a same-page change scroll too.
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route index element={<LandingPage />} />
              <Route path="verify" element={<VerifyLookupPage />} />
              <Route path="verify/:token" element={<VerifyPage />} />
              <Route path="stores/:slug" element={<StorePage />} />
              <Route path="designs/:id" element={<DesignPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="feed" element={<FeedPage />} />
              <Route path="privacy" element={<PrivacyPage />} />
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
                <Route path="stores" element={<StoreListPage />} />
                <Route path="stores/new" element={<StoreFormPage />} />
                <Route path="stores/:slug/edit" element={<StoreFormPage />} />
                <Route path="designs" element={<DesignListPage />} />
                <Route path="designs/new" element={<DesignFormPage />} />
                <Route path="designs/:id/edit" element={<DesignFormPage />} />
                <Route path="team" element={<TeamPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
      <Toaster
        position="top-center"
        toastOptions={{
          classNames: {
            toast: "!rounded-md !border !border-line !bg-white !font-sans !text-ink !shadow-[0_10px_30px_-12px_rgba(36,49,46,0.3)]",
            success: "[&_[data-icon]]:!text-ink",
            error: "[&_[data-icon]]:!text-danger",
          },
        }}
      />
    </BrowserRouter>
  );
}
