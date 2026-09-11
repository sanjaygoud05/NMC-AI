/**
 * Job Service
 * Abstracts API communication for processing jobs and pipeline operations
 */

import type { ProcessingJob } from '@/types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const jobService = {
  async getJobs(params?: { status?: string; phase?: string; limit?: number }) {
    console.log('[jobService] getJobs called:', params);
    return [] as ProcessingJob[];
  },

  async getJob(id: string) {
    console.log('[jobService] getJob called with id:', id);
    return null as ProcessingJob | null;
  },

  async cancelJob(id: string) {
    console.log('[jobService] cancelJob called with id:', id);
    return false;
  },

  async retryJob(id: string) {
    console.log('[jobService] retryJob called with id:', id);
    return null as ProcessingJob | null;
  },

  async getActiveJobs() {
    console.log('[jobService] getActiveJobs called');
    return [] as ProcessingJob[];
  },

  async triggerPipeline(phase: string, options?: Record<string, unknown>) {
    console.log('[jobService] triggerPipeline called:', phase, options);
    return { jobId: '', status: 'queued' };
  },
};
