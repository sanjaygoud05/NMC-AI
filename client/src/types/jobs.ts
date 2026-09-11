/**
 * Jobs Domain Types for SIH26099
 * Represents processing jobs and pipeline execution
 */

export interface ProcessingJob {
  id: string;
  jobType: JobType;
  phase: ProcessingPhase;
  status: JobStatus;
  progress: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
  metadata: JobMetadata;
  results?: JobResults;
}

export interface JobMetadata {
  source: string;
  target: string;
  parameters: Record<string, unknown>;
  priority: 'low' | 'normal' | 'high' | 'critical';
  requestedBy: string;
}

export interface JobResults {
  recordsProcessed: number;
  recordsSucceeded: number;
  recordsFailed: number;
  executionTime: number;
  outputLocation?: string;
  metrics: Record<string, number>;
}

export type JobType = 
  | 'ingestion'
  | 'profiling'
  | 'cleaning'
  | 'attribute_extraction'
  | 'standardization'
  | 'embedding'
  | 'matching'
  | 'validation'
  | 'confidence_scoring'
  | 'master_creation'
  | 'legacy_mapping'
  | 'procurement_analysis'
  | 'evaluation';

export type ProcessingPhase = 
  | 'phase01_ingestion'
  | 'phase02_profiling'
  | 'phase03_cleaning'
  | 'phase04_attribute_extraction'
  | 'phase05_standardization'
  | 'phase06_embedding'
  | 'phase07_candidate_matching'
  | 'phase08_technical_validation'
  | 'phase09_confidence'
  | 'phase10_human_review'
  | 'phase11_common_master'
  | 'phase12_legacy_mapping'
  | 'phase13_procurement'
  | 'phase14_dashboard'
  | 'phase15_evaluation'
  | 'phase16_deployment';

export type JobStatus = 
  | 'pending'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';