/**
 * Evaluation Service
 * Abstracts API communication for model evaluation and reporting
 */

import type { EvaluationReport } from '@/types';

import { API_BASE } from './apiConfig';

export const evaluationService = {
  async getEvaluationReports() {
    console.log('[evaluationService] getEvaluationReports called');
    return [] as EvaluationReport[];
  },

  async getLatestEvaluationReport() {
    console.log('[evaluationService] getLatestEvaluationReport called');
    return null as EvaluationReport | null;
  },

  async runEvaluation(options?: { goldenDataset?: string }) {
    console.log('[evaluationService] runEvaluation called:', options);
    return { jobId: '', status: 'queued' };
  },

  async getModelMetrics() {
    console.log('[evaluationService] getModelMetrics called');
    return {
      precision: 0,
      recall: 0,
      f1Score: 0,
      accuracy: 0,
      totalPairs: 0,
      evaluatedAt: '',
    };
  },
};
