/**
 * Dataset Context & Management
 * Provides global active dataset state with persistence via localStorage.
 * Supported scopes:
 * - 'NONE': Empty/unselected state
 * - 'BASELINE': Official frozen 1,250 records (default for initial compatibility)
 * - 'UPLOAD-YYYYMMDD-XXX': Specific uploaded dataset
 * - 'ALL': Combined view across all available datasets
 */

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface DatasetItem {
  dataset_id: string;
  file_name: string;
  file_hash: string;
  row_count: number;
  column_count: number;
  cpse_summary: Record<string, number>;
  status: 'UPLOADED' | 'VALIDATING' | 'VALIDATED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  is_baseline: boolean;
  uploaded_at: string;
  current_phase?: string;
  progress?: number;
  error_message?: string | null;
}

export interface BackgroundTaskState {
  datasetId: string;
  fileName: string;
  phase: string;
  progress: number;
  status: string;
  rows?: number;
  cpses?: number;
}

export interface CompletedNotificationState {
  datasetId: string;
  fileName: string;
  rows: number;
  cpses: number;
}

interface DatasetContextType {
  activeDatasetId: string;
  datasets: DatasetItem[];
  isLoading: boolean;
  selectDataset: (id: string) => void;
  refreshDatasets: () => Promise<DatasetItem[]>;
  backgroundTask: BackgroundTaskState | null;
  completedNotification: CompletedNotificationState | null;
  startBackgroundTask: (task: BackgroundTaskState) => void;
  dismissBackgroundTask: () => void;
  dismissCompletedNotification: () => void;
  isProgressDialogOpen: boolean;
  setIsProgressDialogOpen: (open: boolean) => void;
}

const DatasetContext = createContext<DatasetContextType | undefined>(undefined);

import { API_BASE } from '@/services/apiConfig';
import { useAuth } from '@/hooks/useAuth';

export function DatasetProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userKey = user?.id || 'guest';
  const storageKey = `sih26099_active_dataset_id_${userKey}`;
  const cacheKey = `nmc_cached_datasets_${userKey}`;
  const taskStorageKey = `sih26099_background_task_${userKey}`;

  const [activeDatasetId, setActiveDatasetId] = useState<string>(() => {
    const stored = localStorage.getItem(storageKey);
    return stored !== null ? stored : 'NONE';
  });

  const [datasets, setDatasets] = useState<DatasetItem[]>(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [backgroundTask, setBackgroundTask] = useState<BackgroundTaskState | null>(() => {
    try {
      const saved = localStorage.getItem(taskStorageKey);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Sync backgroundTask to localStorage
  useEffect(() => {
    if (backgroundTask) {
      try {
        localStorage.setItem(taskStorageKey, JSON.stringify(backgroundTask));
      } catch {
        // ignore
      }
    } else {
      localStorage.removeItem(taskStorageKey);
    }
  }, [backgroundTask, taskStorageKey]);

  const [completedNotification, setCompletedNotification] = useState<CompletedNotificationState | null>(null);
  const [isProgressDialogOpen, setIsProgressDialogOpen] = useState(false);
  const pendingIdsRef = useRef<Set<string>>(new Set());

  // Keep track of pending datasets
  useEffect(() => {
    pendingIdsRef.current = new Set(
      datasets
        .filter((d) => ['UPLOADED', 'VALIDATING', 'VALIDATED', 'PROCESSING'].includes(d.status))
        .map((d) => d.dataset_id)
    );
  }, [datasets]);

  const fetchDatasets = async (): Promise<DatasetItem[]> => {
    try {
      setIsLoading(true);
      const url = user?.id
        ? `${API_BASE}/api/ingest/datasets?user_id=${encodeURIComponent(user.id)}`
        : `${API_BASE}/api/ingest/datasets`;
      const res = await fetch(url, {
        headers: user?.id ? { 'x-user-id': user.id } : {},
      });
      if (res.ok) {
        const data: DatasetItem[] = await res.json();
        setDatasets(data);
        localStorage.setItem(cacheKey, JSON.stringify(data));

        // Auto-recover active background task if any dataset is currently processing
        setBackgroundTask((curr) => {
          if (curr && curr.status === 'PROCESSING') return curr;
          const processing = data.find((d) => d.status === 'PROCESSING' || d.status === 'VALIDATING');
          if (processing) {
            return {
              datasetId: processing.dataset_id,
              fileName: processing.file_name,
              phase: processing.current_phase || 'Standardizing catalog & matching…',
              progress: processing.progress !== undefined ? processing.progress : 25,
              status: processing.status,
              rows: processing.row_count,
              cpses: processing.cpse_count,
            };
          }
          return curr;
        });

        // If persisted selection is a specific upload that no longer exists, reset to NONE
        const saved = localStorage.getItem(storageKey);
        if (saved && saved.startsWith('UPLOAD-') && !data.some((d) => d.dataset_id === saved)) {
          setActiveDatasetId('NONE');
          localStorage.setItem(storageKey, 'NONE');
        }
        return data;
      }
      return [];
    } catch {
      // Backend offline - maintain cached state if available
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Re-fetch datasets whenever the logged-in user changes
  useEffect(() => {
    fetchDatasets();
    const stored = localStorage.getItem(storageKey);
    setActiveDatasetId(stored !== null ? stored : 'NONE');
  }, [user?.id]);

  // Dedicated fast poller for active background task
  useEffect(() => {
    if (!backgroundTask?.datasetId || backgroundTask.status !== 'PROCESSING') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/ingest/datasets/${encodeURIComponent(backgroundTask.datasetId)}`);
        if (!res.ok) return;
        const ds = await res.json();
        if (!ds) return;

        if (ds.status === 'COMPLETED') {
          clearInterval(interval);
          const finishedTask = {
            datasetId: ds.dataset_id,
            fileName: backgroundTask.fileName || ds.file_name,
            rows: ds.row_count || 0,
            cpses: ds.cpse_count || (ds.cpse_summary ? Object.keys(ds.cpse_summary).length : 0),
          };
          setBackgroundTask(null);
          setCompletedNotification(finishedTask);
          await fetchDatasets();
          queryClient.invalidateQueries();
          toast.success(`Dataset "${finishedTask.fileName}" processing completed! View in dashboard.`);
        } else if (ds.status === 'FAILED') {
          clearInterval(interval);
          setBackgroundTask(null);
          toast.error(`Processing failed for ${backgroundTask.fileName}: ${ds.error_message || 'Pipeline execution failed'}`);
        } else {
          setBackgroundTask((prev) =>
            prev
              ? {
                  ...prev,
                  phase: ds.current_phase || prev.phase,
                  progress: ds.progress !== undefined ? ds.progress : prev.progress,
                  status: ds.status,
                  rows: ds.row_count || prev.rows,
                  cpses: ds.cpse_count || prev.cpses,
                }
              : null
          );
        }
      } catch {
        // network retry
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [backgroundTask?.datasetId, backgroundTask?.status, queryClient]);

  // Poll status while any dataset is undergoing validation/processing
  useEffect(() => {
    const hasPending = datasets.some((d) =>
      ['UPLOADED', 'VALIDATING', 'VALIDATED', 'PROCESSING'].includes(d.status)
    );
    if (!hasPending) return;

    const interval = setInterval(async () => {
      const updated = await fetchDatasets();
      if (!updated || updated.length === 0) return;

      const prevPending = pendingIdsRef.current;
      const finished = updated.filter(
        (d) => prevPending.has(d.dataset_id) && ['COMPLETED', 'FAILED'].includes(d.status)
      );

      if (finished.length > 0) {
        // Refresh active queries only when background pipeline completes
        queryClient.invalidateQueries();
        finished.forEach((d) => {
          if (d.status === 'COMPLETED') {
            // Trigger completion modal if not already shown
            setCompletedNotification({
              datasetId: d.dataset_id,
              fileName: d.file_name,
              rows: d.row_count || 0,
              cpses: d.cpse_count || (d.cpse_summary ? Object.keys(d.cpse_summary).length : 0),
            });
            toast.success(`Pipeline completed for ${d.file_name}! All modules and metrics updated.`);
          } else {
            toast.error(`Processing failed for ${d.file_name}: ${d.error_message || 'Pipeline error'}`);
          }
        });
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [datasets, queryClient, user?.id]);

  const selectDataset = (id: string) => {
    setActiveDatasetId(id);
    localStorage.setItem(storageKey, id);
    // Instant switch without destroying entire React Query cache
  };

  const startBackgroundTask = (task: BackgroundTaskState) => {
    setBackgroundTask(task);
  };

  const dismissBackgroundTask = () => {
    setBackgroundTask(null);
  };

  const dismissCompletedNotification = () => {
    setCompletedNotification(null);
  };

  return (
    <DatasetContext.Provider
      value={{
        activeDatasetId,
        datasets,
        isLoading,
        selectDataset,
        refreshDatasets: fetchDatasets,
        backgroundTask,
        completedNotification,
        startBackgroundTask,
        dismissBackgroundTask,
        dismissCompletedNotification,
        isProgressDialogOpen,
        setIsProgressDialogOpen,
      }}
    >
      {children}
    </DatasetContext.Provider>
  );
}

export function useDataset() {
  const context = useContext(DatasetContext);
  if (!context) {
    throw new Error('useDataset must be used within a DatasetProvider');
  }
  return context;
}
