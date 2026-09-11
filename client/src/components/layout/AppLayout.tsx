import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronDown, Moon, Sun, Loader2, Database } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDataset } from '@/contexts/DatasetContext';

interface AppLayoutProps {
  children: ReactNode;
  requireRole?: ('admin' | 'manager' | 'employee')[];
}

export function AppLayout({ children, requireRole }: AppLayoutProps) {
  const { user, role, availableRoles, isLoading, isSwitchingRole, switchRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { activeDatasetId, datasets, selectDataset } = useDataset();

  if (isLoading || (requireRole && !role)) {
    return (
      <div className="dark min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 w-full max-w-md p-8">
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-4 w-1/2 mx-auto" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Check role-based access
  if (requireRole && role && !requireRole.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-h-screen">
          <header className="h-14 border-b border-border bg-card flex items-center px-4 sticky top-0 z-10">
            <SidebarTrigger className="mr-2 md:mr-4 text-foreground" />
            <div className="flex-1" />

            {/* Dataset Selector */}
            <div className="mr-3 flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden md:inline">Dataset:</span>
              <Select value={activeDatasetId} onValueChange={selectDataset}>
                <SelectTrigger className="h-8 text-xs font-medium w-[170px] sm:w-[210px] bg-background border-border">
                  <Database className="h-3.5 w-3.5 mr-1.5 text-primary shrink-0" />
                  <SelectValue placeholder="Select dataset" />
                </SelectTrigger>
                <SelectContent align="end" className="bg-card border-border">
                  <SelectItem value="ALL" className="text-xs font-semibold">
                    All datasets (Combined Scope)
                  </SelectItem>
                  <SelectItem value="BASELINE" className="text-xs">
                    Baseline (1,250 records)
                  </SelectItem>
                  {datasets
                    .filter((d) => d.dataset_id !== "BASELINE")
                    .map((d) => (
                      <SelectItem key={d.dataset_id} value={d.dataset_id} className="text-xs">
                        {d.dataset_id} ({d.row_count} rows)
                      </SelectItem>
                    ))}
                  <SelectItem value="NONE" className="text-xs text-muted-foreground">
                    No active dataset
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="mr-2 text-muted-foreground hover:text-foreground"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>

            {/* Role Switcher - only shown when user holds multiple roles */}
            {availableRoles.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-primary/30 text-primary bg-primary/10 hover:bg-primary/20"
                  disabled={isSwitchingRole}
                >
                  {isSwitchingRole ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary mr-1.5" />
                  )}
                  <span className="hidden sm:inline">Role: </span>
                  {role?.charAt(0).toUpperCase()}{role?.slice(1)}
                  <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border">
                {availableRoles.map((r) => (
                  <DropdownMenuItem
                    key={r}
                    onClick={() => switchRole(r)}
                    className={role === r ? 'bg-muted font-medium' : ''}
                    disabled={isSwitchingRole}
                  >
                    <span className={`h-2 w-2 rounded-full mr-2 ${role === r ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                    {r.charAt(0).toUpperCase()}{r.slice(1)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            )}
          </header>
          <div className="flex-1 p-4 md:p-6 bg-background bg-dot-pattern">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
