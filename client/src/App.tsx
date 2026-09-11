import { useEffect, lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { DatasetProvider } from "@/contexts/DatasetContext";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

// Lazy-loaded pages — Phase 0 shells
const Ingest = lazy(() => import("./pages/Ingest"));
const Materials = lazy(() => import("./pages/Materials"));
const MaterialDetail = lazy(() => import("./pages/MaterialDetail"));
const Matches = lazy(() => import("./pages/Matches"));
const MatchDetail = lazy(() => import("./pages/MatchDetail"));
const Review = lazy(() => import("./pages/Review"));
const Standardization = lazy(() => import("./pages/Standardization"));
const CommonMaster = lazy(() => import("./pages/CommonMaster"));
const CommonMasterDetail = lazy(() => import("./pages/CommonMasterDetail"));
const LegacyMapping = lazy(() => import("./pages/LegacyMapping"));
const Procurement = lazy(() => import("./pages/Procurement"));
const DataQuality = lazy(() => import("./pages/DataQuality"));
const CPSEAnalytics = lazy(() => import("./pages/CPSEAnalytics"));
const Evaluation = lazy(() => import("./pages/Evaluation"));
const Jobs = lazy(() => import("./pages/Jobs"));
const Settings = lazy(() => import("./pages/Settings"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="text-muted-foreground text-sm">Loading…</div>
  </div>
);

const App = () => {
  // Force dark mode as default on initial load
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (!stored) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }
  }, []);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <DatasetProvider>
            <TooltipProvider>
              <Sonner />
              <BrowserRouter>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                  {/* Root redirect */}
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />

                  {/* Auth */}
                  <Route path="/auth" element={<Auth />} />

                  {/* Core pages */}
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/ingest" element={<Ingest />} />

                  {/* Material Explorer */}
                  <Route path="/materials" element={<Materials />} />
                  <Route path="/materials/:id" element={<MaterialDetail />} />

                  {/* Standardization */}
                  <Route path="/standardization" element={<Standardization />} />

                  {/* Matching & Harmonization */}
                  <Route path="/matches" element={<Matches />} />
                  <Route path="/matches/:id" element={<MatchDetail />} />

                  {/* Review Queue */}
                  <Route path="/review" element={<Review />} />

                  {/* Common Material Master */}
                  <Route path="/common-master" element={<CommonMaster />} />
                  <Route path="/common-master/:commonCode" element={<CommonMasterDetail />} />

                  {/* Legacy Mapping */}
                  <Route path="/legacy-mapping" element={<LegacyMapping />} />

                  {/* Analytics */}
                  <Route path="/data-quality" element={<DataQuality />} />
                  <Route path="/cpse-analytics" element={<CPSEAnalytics />} />
                  <Route path="/procurement" element={<Procurement />} />
                  <Route path="/evaluation" element={<Evaluation />} />

                  {/* System */}
                  <Route path="/jobs" element={<Jobs />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/settings" element={<Settings />} />

                  {/* 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </DatasetProvider>
      </AuthProvider>
    </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
