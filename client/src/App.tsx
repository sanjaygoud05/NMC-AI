import { useEffect } from "react";
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
import Ingest from "./pages/Ingest";
import DatasetHistory from "./pages/DatasetHistory";
import Materials from "./pages/Materials";
import MaterialDetail from "./pages/MaterialDetail";
import Matches from "./pages/Matches";
import MatchDetail from "./pages/MatchDetail";
import Review from "./pages/Review";
import Standardization from "./pages/Standardization";
import CommonMaster from "./pages/CommonMaster";
import CommonMasterDetail from "./pages/CommonMasterDetail";
import LegacyMapping from "./pages/LegacyMapping";
import Procurement from "./pages/Procurement";
import DataQuality from "./pages/DataQuality";
import CPSEAnalytics from "./pages/CPSEAnalytics";
import Evaluation from "./pages/Evaluation";
import Jobs from "./pages/Jobs";
import Settings from "./pages/Settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

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
                <Routes>
                  {/* Root redirect */}
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />

                  {/* Auth */}
                  <Route path="/auth" element={<Auth />} />

                  {/* Core pages */}
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/ingest" element={<Ingest />} />
                  <Route path="/dataset-history" element={<DatasetHistory />} />
                  <Route path="/history" element={<Navigate to="/dataset-history" replace />} />

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

                  {/* Procurement */}
                  <Route path="/procurement" element={<Procurement />} />

                  {/* Analytics & Quality */}
                  <Route path="/data-quality" element={<DataQuality />} />
                  <Route path="/cpse-analytics" element={<CPSEAnalytics />} />
                  <Route path="/evaluation" element={<Evaluation />} />

                  {/* System */}
                  <Route path="/jobs" element={<Jobs />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/settings" element={<Settings />} />

                  {/* 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </DatasetProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
