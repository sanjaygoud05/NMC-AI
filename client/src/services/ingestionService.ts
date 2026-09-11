/**
 * Ingestion Service
 * Abstracts API communication for data ingestion & profiling operations (Phase 1)
 * and normalization operations (Phase 2)
 */

import type { IngestionJob, IngestionStatus, NormalizationStatus } from '@/types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const ingestionService = {
  async getStatus() {
    try {
      const res = await fetch(`${API_BASE}/api/ingest/status`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return null;
  },

  async getProfile() {
    try {
      const res = await fetch(`${API_BASE}/api/ingest/profile`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return null;
  },

  async getDataQuality() {
    try {
      const res = await fetch(`${API_BASE}/api/ingest/data-quality`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return null;
  },

  // -------------------------------------------------------
  // Phase 2 — Normalization
  // -------------------------------------------------------

  /**
   * Get normalization status and summary report (Phase 2).
   * Returns the persisted normalization_report.json if run,
   * or a not_run status if Phase 2 has not been executed.
   */
  async getNormalization(): Promise<NormalizationStatus> {
    try {
      const res = await fetch(`${API_BASE}/api/ingest/normalization`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return {
      status: 'not_run',
      normalized_file_exists: false,
      report: null,
    };
  },

  /**
   * Get the full normalization report JSON (Phase 2).
   */
  async getNormalizationReport() {
    try {
      const res = await fetch(`${API_BASE}/api/ingest/normalization/report`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return null;
  },

  /**
   * Trigger Phase 2 normalization pipeline execution.
   */
  async runNormalization() {
    const res = await fetch(`${API_BASE}/api/ingest/normalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) return await res.json();
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail || 'Normalization pipeline failed');
  },

  // -------------------------------------------------------
  // Shared ingestion utilities
  // -------------------------------------------------------

  async uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('supabase.auth.token') || '';
    const res = await fetch(`${API_BASE}/api/ingest/upload`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to upload dataset file');
    }
    return res.json();
  },

  async getIngestionJobs() {
    try {
      const res = await fetch(`${API_BASE}/api/ingest/jobs`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return [] as IngestionJob[];
  },

  async getIngestionJob(jobId: string) {
    try {
      const res = await fetch(`${API_BASE}/api/ingest/jobs/${jobId}`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return null as IngestionJob | null;
  },

  async getIngestionStatus(jobId: string) {
    try {
      const res = await fetch(`${API_BASE}/api/ingest/jobs/${jobId}/status`);
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return null as IngestionStatus | null;
  },

  async cancelIngestion(jobId: string) {
    try {
      const res = await fetch(`${API_BASE}/api/ingest/jobs/${jobId}/cancel`, {
        method: 'POST',
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    return false;
  },

  async validateFile(file: File) {
    return { valid: true, errors: [] as string[], warnings: [] as string[] };
  },
};
