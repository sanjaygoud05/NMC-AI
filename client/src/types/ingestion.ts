/**
 * Ingestion Domain Types for SIH26099
 * Represents data ingestion and pipeline processing
 */

export interface IngestionJob {
  id: string;
  jobType: IngestionType;
  source: string;
  status: JobStatus;
  progress: number;
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
  metadata: Record<string, unknown>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: ValidationSummary;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  severity: 'error' | 'critical';
}

export interface ValidationWarning {
  row: number;
  field: string;
  message: string;
  severity: 'warning' | 'info';
}

export interface ValidationSummary {
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  completeness: number;
}

export interface QualityReport {
  jobId: string;
  overallScore: number;
  completeness: number;
  accuracy: number;
  consistency: number;
  validity: number;
  fieldAnalysis: FieldAnalysis[];
  recommendations: string[];
}

export interface FieldAnalysis {
  fieldName: string;
  completeness: number;
  validity: number;
  consistency: number;
  uniqueValues: number;
  nullCount: number;
}

export type IngestionType = 
  | 'initial_import'
  | 'incremental_update'
  | 'bulk_upload'
  | 'api_sync';

export type JobStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface IngestionStatus {
  jobId: string;
  status: JobStatus;
  progress: number;
  currentPhase: string;
  message: string;
  estimatedCompletion?: string;
}

// -------------------------------------------------------
// Phase 2 — Normalization Types
// -------------------------------------------------------

export interface NormalizationReport {
  phase: string;
  dataset_rows: number;
  records_changed: number;
  records_unchanged: number;
  percentage_changed: number;
  columns_processed: string[];
  rule_application_counts: Record<string, number>;
  field_change_counts: Record<string, number>;
  uom_mapping_counts: Record<string, number>;
  unique_descriptions: {
    before_normalization: number;
    after_normalization: number;
  };
  uom_variants: {
    before_normalization: number;
    after_normalization: number;
  };
  missing_values_preserved: number;
  values_artificially_filled: number;
  material_codes_changed: number;
  raw_dataset_hash_before: string;
  raw_dataset_hash_after: string;
  raw_dataset_unchanged: boolean;
  output_row_count: number;
  input_row_count: number;
}

export interface NormalizationStatus {
  status: 'not_run' | 'completed' | 'failed';
  normalized_file_exists: boolean;
  message?: string;
  report?: NormalizationReport;
}