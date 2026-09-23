import { useEffect } from 'react';
import { API_BASE } from './services/apiConfig';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { ThemeProvider } from '@/hooks/useTheme';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ManageCPSE from './pages/ManageCPSE';
import Materials from './pages/Materials';
import FindMapping from './pages/FindMapping';
import Review from './pages/Review';
import MatchDetail from './pages/MatchDetail';
import CommonMaster from './pages/CommonMaster';
import Analytics from './pages/Analytics';
import AuditTrail from './pages/AuditTrail';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => {
  // Force dark mode as default on initial load
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (!stored) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  }, []);

  // Health ping
  useEffect(() => {
    fetch(`${API_BASE}/api/health`, { method: 'GET' }).catch(() => {
      // keep alive
    });
  }, []);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Sonner />
            <BrowserRouter>
              <Routes>
                {/* Default */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />

                {/* Authentication */}
                <Route path="/login" element={<Login />} />
                <Route path="/auth" element={<Navigate to="/login" replace />} />

                {/* Core NMC Platform Pages */}
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/manage-cpses" element={<ManageCPSE />} />
                <Route path="/manage-cpse" element={<Navigate to="/manage-cpses" replace />} />
                <Route path="/cpses" element={<Navigate to="/manage-cpses" replace />} />
                <Route path="/cpse" element={<Navigate to="/manage-cpses" replace />} />
                <Route path="/materials" element={<Materials />} />
                <Route path="/materials/:id" element={<Materials />} />

                {/* AI Matching & Review */}
                <Route path="/find-mapping" element={<FindMapping />} />
                <Route path="/matches" element={<Navigate to="/find-mapping" replace />} />
                <Route path="/matches/:id" element={<MatchDetail />} />
                <Route path="/review" element={<Review />} />
                <Route path="/review/:id" element={<MatchDetail />} />

                {/* Common Material Master */}
                <Route path="/common-master" element={<CommonMaster />} />
                <Route path="/common-master/:code" element={<CommonMaster />} />

                {/* Governance & Analytics */}
                <Route path="/audit" element={<AuditTrail />} />
                <Route path="/analytics" element={<Analytics />} />

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
