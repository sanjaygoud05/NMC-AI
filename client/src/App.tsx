import { useEffect } from 'react';
import { API_BASE } from './services/apiConfig';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
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
import ProcurementIntelligence from './pages/ProcurementIntelligence';
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

const RootRoute = () => {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Initializing NMC-AI...</p>
        </div>
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={isAdmin ? '/dashboard' : '/review'} replace />;
};

const LoginRoute = () => {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) {
    return <Navigate to={isAdmin ? '/dashboard' : '/review'} replace />;
  }
  return <Login />;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Initializing NMC-AI...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
};

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
                {/* Default root: directly shows Login if unauthenticated */}
                <Route path="/" element={<RootRoute />} />

                {/* Authentication */}
                <Route path="/login" element={<LoginRoute />} />
                <Route path="/auth" element={<Navigate to="/login" replace />} />

                {/* Core NMC Platform Pages */}
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/manage-cpses" element={<ProtectedRoute><ManageCPSE /></ProtectedRoute>} />
                <Route path="/manage-cpse" element={<Navigate to="/manage-cpses" replace />} />
                <Route path="/cpses" element={<Navigate to="/manage-cpses" replace />} />
                <Route path="/cpse" element={<Navigate to="/manage-cpses" replace />} />
                <Route path="/materials" element={<ProtectedRoute><Materials /></ProtectedRoute>} />
                <Route path="/materials/:id" element={<ProtectedRoute><Materials /></ProtectedRoute>} />

                {/* AI Matching & Review */}
                <Route path="/find-mapping" element={<ProtectedRoute><FindMapping /></ProtectedRoute>} />
                <Route path="/matches" element={<Navigate to="/find-mapping" replace />} />
                <Route path="/matches/:id" element={<ProtectedRoute><MatchDetail /></ProtectedRoute>} />
                <Route path="/review" element={<ProtectedRoute><Review /></ProtectedRoute>} />
                <Route path="/review/:id" element={<ProtectedRoute><MatchDetail /></ProtectedRoute>} />

                {/* Common Material Master */}
                <Route path="/common-master" element={<ProtectedRoute><CommonMaster /></ProtectedRoute>} />
                <Route path="/common-master/:code" element={<ProtectedRoute><CommonMaster /></ProtectedRoute>} />

                {/* Governance & Analytics */}
                <Route path="/audit" element={<ProtectedRoute><AuditTrail /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                <Route path="/procurement-intelligence" element={<ProtectedRoute><ProcurementIntelligence /></ProtectedRoute>} />
                <Route path="/procurement" element={<Navigate to="/procurement-intelligence" replace />} />

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
