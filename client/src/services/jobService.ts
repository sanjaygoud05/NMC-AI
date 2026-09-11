/**
 * Job Service
 * Abstracts API communication for processing jobs and pipeline operations
 */

import type { ProcessingJob } from '@/types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const jobService = {
  async getJobs(params?: { status?: string; phase?: string; limit?: number }) {
    try {
      const res = await fetch(`${API_BASE}/api/ingest/jobs`);
      if (res.ok) {
        const data = await res.json();
        return data as ProcessingJob[];
      }
    } catch (err) {
      console.error('[jobService] getJobs failed:', err);
    }
    return [] as ProcessingJob[];
  },

  async getJob(id: string) {
    try {
      const res = await fetch(`${API_BASE}/api/ingest/jobs/${encodeURIComponent(id)}`);
      if (res.ok) {
        return await res.json() as ProcessingJob;
      }
    } catch (err) {
      console.error('[jobService] getJob failed:', err);
    }
    return null as ProcessingJob | null;
  },

  async cancelJob(id: string) {
    try {
      const res = await fetch(`${API_BASE}/api/ingest/jobs/${encodeURIComponent(id)}/cancel`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        return data.cancelled === true;
      }
    } catch (err) {
      console.error('[jobService] cancelJob failed:', err);
    }
    return false;
  },

  async retryJob(id: string) {
    console.log('[jobService] retryJob called with id:', id);
    return null as ProcessingJob | null;
  },

  async getActiveJobs() {
    try {
      const res = await fetch(`${API_BASE}/api/ingest/jobs`);
      if (res.ok) {
        const data = await res.json() as ProcessingJob[];
        return data.filter(job => job.status === 'PROCESSING' || job.status === 'QUEUED');
      }
    } catch (err) {
      console.error('[jobService] getActiveJobs failed:', err);
    }
    return [] as ProcessingJob[];
  },

  async triggerPipeline(phase: string, options?: Record<string, unknown>) {
    console.log('[jobService] triggerPipeline called:', phase, options);
    return { jobId: '', status: 'queued' };
  },
};
