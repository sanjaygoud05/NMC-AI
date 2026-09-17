import { ReactNode } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown,
  Moon,
  Sun,
  Loader2,
  Database,
  Zap,
  CheckCircle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { PipelineProgressModal } from '@/components/shared/PipelineProgressModal';

interface AppLayoutProps {
  children: ReactNode;
  requireRole?: ('admin' | 'manager' | 'employee')[];
}

export function AppLayout({ children, requireRole }: AppLayoutProps) {
  const navigate = useNavigate();
  const { user, role, availableRoles, isLoading, isSwitchingRole, switchRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const {
    activeDatasetId,
    datasets,
    selectDataset,
    backgroundTask,
    completedNotification,
    dismissCompletedNotification,
    isProgressDialogOpen,
    setIsProgressDialogOpen,
  } = useDataset();

  // Show skeleton while auth state is being determined
  if (isLoading) {
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

  // Detect if active dataset is currently being processed
  const activeDs = datasets.find((d) => d.dataset_id === activeDatasetId);
  const isProcessing = activeDs && ['UPLOADED', 'VALIDATING', 'VALIDATED', 'PROCESSING'].includes(activeDs.status);
  const processingPhase = (activeDs as any)?.current_phase || null;
  const processingProgress = (activeDs as any)?.progress ?? 0;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background overflow-x-hidden">
        <AppSidebar />
        <main className="flex-1 min-w-0 flex flex-col min-h-screen overflow-x-hidden max-w-full">
          <header className="h-14 border-b border-border bg-card flex items-center px-2.5 sm:px-4 sticky top-0 z-10 gap-1.5 sm:gap-2">
            <SidebarTrigger className="text-foreground shrink-0" />
            <div className="flex-1" />

            {/* Dataset Selector */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xs text-muted-foreground hidden lg:inline">Dataset:</span>
              <Select value={activeDatasetId} onValueChange={selectDataset}>
                <SelectTrigger className="h-8 text-xs font-medium w-[125px] xs:w-[155px] sm:w-[190px] md:w-[220px] bg-background border-border shrink-0">
                  <Database className="h-3.5 w-3.5 mr-1 text-primary shrink-0" />
                  <SelectValue placeholder="Select dataset" className="truncate" />
                </SelectTrigger>
                <SelectContent align="end" className="bg-card border-border max-w-[280px]">
                  <SelectItem value="NONE" className="text-xs font-medium text-muted-foreground">
                    No dataset selected
                  </SelectItem>
                  <SelectItem value="BASELINE" className="text-xs">
                    Frozen Baseline
                  </SelectItem>
                  {datasets
                    .filter((d) => !d.is_baseline && d.dataset_id !== "BASELINE")
                    .map((d) => (
                      <SelectItem key={d.dataset_id} value={d.dataset_id} className="text-xs">
                        <span className="truncate block max-w-[220px]">{d.file_name}</span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>

            {/* Header Background Processing Status Indicator */}
            {backgroundTask && backgroundTask.status === 'PROCESSING' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/ingest')}
                className="h-8 px-2 sm:px-3 text-xs bg-primary/10 border-primary/30 text-primary hover:bg-primary/20 gap-1.5 shrink-0 rounded-xl"
                title="Pipeline running in background. Click to view progress."
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                <span className="hidden sm:inline font-medium truncate max-w-[130px]">
                  {backgroundTask.fileName}
                </span>
                <Badge className="bg-primary text-primary-foreground text-[10px] font-mono font-bold px-1.5 py-0 h-4">
                  {backgroundTask.progress}%
                </Badge>
              </Button>
            )}

            {/* Role Switcher - only shown when user holds multiple roles */}
            {availableRoles.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 sm:px-3 text-xs border-primary/30 text-primary bg-primary/10 hover:bg-primary/20 shrink-0"
                  disabled={isSwitchingRole}
                >
                  {isSwitchingRole ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1 sm:mr-1.5" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary mr-1 sm:mr-1.5" />
                  )}
                  <span className="hidden sm:inline">Role: </span>
                  <span className="capitalize">{role}</span>
                  <ChevronDown className="ml-1 sm:ml-1.5 h-3 w-3 sm:h-3.5 sm:w-3.5 opacity-70" />
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

          <div className="flex-1 p-2.5 sm:p-4 md:p-6 bg-background bg-dot-pattern w-full min-w-0 max-w-full overflow-x-hidden">
            {children}
          </div>

          {/* Global Completion Modal with "View Dashboard" */}
          <Dialog
            open={!!completedNotification}
            onOpenChange={(open) => {
              if (!open) dismissCompletedNotification();
            }}
          >
            <DialogContent className="sm:max-w-md bg-card border-border shadow-2xl p-6 rounded-2xl">
              <DialogHeader className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-500">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold text-foreground">
                      Dataset Harmonization Completed!
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                      All pipeline phases have executed successfully.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="py-3 space-y-3">
                <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                  <p className="text-xs text-foreground font-medium">
                    Dataset <span className="font-bold text-emerald-600 dark:text-emerald-400">"{completedNotification?.fileName}"</span> is fully standardized and harmonized across all CPSEs.
                  </p>
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-emerald-500/20">
                    <div className="p-2 rounded-lg bg-background/60 text-center">
                      <span className="text-[10px] text-muted-foreground block font-medium">Processed Records</span>
                      <span className="text-sm font-bold text-foreground">
                        {completedNotification?.rows?.toLocaleString() ?? '—'}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-background/60 text-center">
                      <span className="text-[10px] text-muted-foreground block font-medium">CPSE Entities</span>
                      <span className="text-sm font-bold text-foreground">
                        {completedNotification?.cpses ?? '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={dismissCompletedNotification}
                  className="text-xs"
                >
                  Stay Here
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (completedNotification?.datasetId) {
                      selectDataset(completedNotification.datasetId);
                    }
                    dismissCompletedNotification();
                    navigate('/dashboard');
                  }}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-1.5 shadow-md shadow-primary/25"
                >
                  View Dashboard
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Detailed Progress Modal */}
          {backgroundTask && (
            <PipelineProgressModal
              open={isProgressDialogOpen}
              onOpenChange={setIsProgressDialogOpen}
              task={backgroundTask}
              onRunInBackground={() => setIsProgressDialogOpen(false)}
            />
          )}
        </main>
      </div>
    </SidebarProvider>
  );
}

