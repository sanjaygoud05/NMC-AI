import React, { ReactNode } from 'react';
import { Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Moon, Sun, Shield, UserCheck, AlertCircle, LogOut } from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
  requireAdmin?: boolean;
  requireReviewer?: boolean;
}

export function AppLayout({ children, requireAdmin, requireReviewer }: AppLayoutProps) {
  const { role, isAdmin, isReviewer, canViewReviewQueue, isAuthenticated, isLoading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

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

  // Authentication gate
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Authorization gate
  if (requireAdmin && !isAdmin) {
    return (
      <SidebarProvider>
        <div className="h-screen flex w-full bg-background overflow-hidden">
          <AppSidebar />
          <main className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto p-8 items-center justify-center">
            <div className="max-w-md w-full p-6 rounded-xl border border-destructive/20 bg-destructive/5 text-center flex flex-col items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Admin Access Required</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  This page requires administrator privileges. Please sign in with the admin password to continue.
                </p>
              </div>
              <Link to="/login" state={{ from: location.pathname }}>
                <Button className="gap-2">
                  Sign in as Admin
                </Button>
              </Link>
            </div>
          </main>
        </div>
      </SidebarProvider>
    );
  }

  if (requireReviewer && !canViewReviewQueue) {
    return (
      <SidebarProvider>
        <div className="h-screen flex w-full bg-background overflow-hidden">
          <AppSidebar />
          <main className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto p-8 items-center justify-center">
            <div className="max-w-md w-full p-6 rounded-xl border border-amber-500/20 bg-amber-500/5 text-center flex flex-col items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <UserCheck className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Reviewer Key Required</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  The Review Queue requires a valid Reviewer Key to evaluate candidate pairs and confirm harmonized Common Material Master records.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {isAdmin && (
                  <Link to="/dashboard">
                    <Button variant="outline" className="gap-2">
                      Return to Dashboard
                    </Button>
                  </Link>
                )}
                <Link to="/login" state={{ from: location.pathname, tab: 'reviewer' }}>
                  <Button className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
                    Enter Reviewer Key
                  </Button>
                </Link>
              </div>
            </div>
          </main>
        </div>
      </SidebarProvider>
    );
  }


  return (
    <SidebarProvider>
      <div className="h-screen flex w-full bg-background overflow-hidden">
        <AppSidebar />
        <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden max-w-full">
          {/* Header */}
          <header className="h-16 border-b border-border bg-card/60 backdrop-blur-md flex items-center justify-between px-4 z-10 shrink-0">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  NMC Standard
                </span>
                <span className="text-muted-foreground/40">/</span>
                <span className="text-xs font-medium text-foreground">
                  AI-Driven Material Harmonization
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {role && (
                <Badge
                  variant="outline"
                  className={`text-xs px-2.5 py-0.5 capitalize border ${
                    role === 'admin'
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {role}
                </Badge>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>

              {isAuthenticated && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              )}
            </div>
          </header>

          {/* Page Body */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
