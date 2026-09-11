/**
 * Dataset Context & Management
 * Provides global active dataset state with persistence via localStorage.
 * Supported scopes:
 * - 'NONE': Empty/unselected state
 * - 'BASELINE': Official frozen 1,250 records (default for initial compatibility)
 * - 'UPLOAD-YYYYMMDD-XXX': Specific uploaded dataset
 * - 'ALL': Combined view across all available datasets
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';

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
  error_message?: string | null;
}

interface DatasetContextType {
  activeDatasetId: string;
  datasets: DatasetItem[];
  isLoading: boolean;
  selectDataset: (id: string) => void;
  refreshDatasets: () => Promise<void>;
}

const DatasetContext = createContext<DatasetContextType | undefined>(undefined);

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const STORAGE_KEY = 'sih26099_active_dataset_id';

export function DatasetProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [activeDatasetId, setActiveDatasetId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || 'NONE';
  });
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDatasets = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE}/api/ingest/datasets`);
      if (res.ok) {
        const data: DatasetItem[] = await res.json();
        setDatasets(data);
        // If persisted selection is a specific upload that no longer exists, reset to NONE
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && saved.startsWith('UPLOAD-') && !data.some((d) => d.dataset_id === saved)) {
          setActiveDatasetId('NONE');
          localStorage.setItem(STORAGE_KEY, 'NONE');
        }
      }
    } catch {
      // Backend offline - maintain empty state without auto-selecting baseline
      setDatasets([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  // Poll status while any dataset is undergoing validation/processing
  useEffect(() => {
    const hasPending = datasets.some((d) =>
      ['UPLOADED', 'VALIDATING', 'VALIDATED', 'PROCESSING'].includes(d.status)
    );
    if (!hasPending) return;
    const interval = setInterval(() => {
      fetchDatasets();
    }, 3000);
    return () => clearInterval(interval);
  }, [datasets]);

  const selectDataset = (id: string) => {
    setActiveDatasetId(id);
    localStorage.setItem(STORAGE_KEY, id);
    // Invalidate all dataset-dependent queries to ensure fresh data
    queryClient.invalidateQueries();
  };

  return (
    <DatasetContext.Provider
      value={{
        activeDatasetId,
        datasets,
        isLoading,
        selectDataset,
        refreshDatasets: fetchDatasets,
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
