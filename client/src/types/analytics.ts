/**
 * Analytics Domain Types for SIH26099
 * Represents dashboard and analytics data
 */

export interface DashboardMetrics {
  totalMaterials: number;
  totalCPSEs: number;
  standardizedMaterials: number;
  harmonizedGroups: number;
  pendingReviews: number;
  highConfidenceMatches: number;
  duplicateCandidates: number;
  dataQualityScore: number;
  processingProgress: number;
}

export interface DataQualityMetrics {
  overallScore: number;
  completeness: number;
  accuracy?: number;
  consistency: number;
  validity: number;
  uniqueness?: number;
  missingnessRate?: number;
  duplicateRate?: number;
  fieldQuality?: Array<{
    field: string;
    completeness: number;
    validity: number;
    consistency: number;
    status: string;
  }>;
  completenessByField?: FieldQuality[];
  errorCounts?: ErrorCounts;
}

export interface FieldQuality {
  fieldName: string;
  completeness: number;
  validity: number;
  consistency: number;
}

export interface ErrorCounts {
  missingValues: number;
  invalidFormats: number;
  duplicates: number;
  outliers: number;
}

export interface MaterialStats {
  byCategory: CategoryStats[];
  byCPSE: CPSEStats[];
  byStatus: StatusStats[];
  byQuality: QualityStats[];
  temporalTrends: TemporalData[];
}

export interface CategoryStats {
  category: string;
  count: number;
  percentage: number;
  avgStandardizationTime: number;
}

export interface CPSEStats {
  cpseId: string;
  cpseName: string;
  materialCount: number;
  standardizationRate: number;
  qualityScore: number;
}

export interface StatusStats {
  status: string;
  count: number;
  percentage: number;
}

export interface QualityStats {
  qualityRange: string;
  count: number;
  percentage: number;
}

export interface TemporalData {
  date: string;
  count: number;
  cumulativeCount: number;
}

export interface EvaluationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
}

export interface EvaluationReport {
  id: string;
  runAt: string;
  goldenDataset: string;
  totalPairs: number;
  evaluatedPairs: number;
  precision: number;
  recall: number;
  f1Score: number;
  accuracy: number;
  thresholdUsed: number;
  notes?: string;
}