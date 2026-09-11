/**
 * CPSE Domain Types for SIH26099
 * Represents CPSE (Central Public Sector Enterprises) entities
 */

export interface CPSE {
  id: string;
  name: string;
  code: string;
  sector: string;
  region: string;
  materialCount: number;
  standardizationProgress: number;
  lastSyncAt: string;
  status: CPSEStatus;
}

export interface CPSEAnalytics {
  cpseId: string;
  cpseName: string;
  totalMaterials: number;
  standardizedMaterials: number;
  harmonizedMaterials: number;
  duplicateRate: number;
  dataQualityScore: number;
  topCategories: CategoryDistribution[];
  monthlyIngestion: MonthlyIngestionData[];
}

export interface CategoryDistribution {
  category: string;
  count: number;
  percentage: number;
}

export interface MonthlyIngestionData {
  month: string;
  count: number;
  harmonized: number;
}

export type CPSEStatus = 
  | 'active'
  | 'inactive'
  | 'pending'
  | 'error';