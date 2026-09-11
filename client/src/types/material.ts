/**
 * Material Domain Types for SIH26099
 * Represents source/legacy materials from CPSEs
 */

export interface Material {
  id: string;
  materialCode: string;
  cpseId: string;
  description: string;
  normalizedDescription?: string;
  standardizedDescription?: string;
  category?: string;
  materialType?: string;
  unit?: string;
  manufacturer?: string;
  attributes?: Record<string, string | number | null>;
  standardizationStatus: StandardizationStatus;
  matchStatus: MatchStatus;
  confidenceScore?: number;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialAttribute {
  id: string;
  materialId: string;
  attributeName: string;
  attributeValue: string;
  attributeType: string;
  confidence?: number;
  source: 'extracted' | 'manual' | 'standardized';
  createdAt: string;
}

export interface StandardizedMaterial {
  id: string;
  commonCode: string;
  commonDescription: string;
  category: string;
  materialType: string;
  unit: string;
  technicalSpecifications: Record<string, string>;
  qualityAttributes: Record<string, string>;
  cpseCount: number;
  legacyMappingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommonMaterial {
  id: string;
  commonCode: string;
  commonDescription: string;
  category: string;
  materialType: string;
  unit: string;
  technicalSpecs: Record<string, string>;
  qualitySpecs: Record<string, string>;
  sourceMaterials: SourceMaterialMapping[];
  cpseCoverage: string[];
  totalVolume: number;
  lastUpdated: string;
}

export interface LegacyMapping {
  id: string;
  commonMaterialId: string;
  sourceMaterialId: string;
  cpseId: string;
  legacyCode: string;
  legacyDescription: string;
  mappingConfidence: number;
  mappingMethod: 'manual' | 'algorithmic' | 'ml';
  mappedAt: string;
  mappedBy: string;
  isActive: boolean;
}

export interface SourceMaterialMapping {
  materialId: string;
  materialCode: string;
  cpseId: string;
  description: string;
  similarityScore: number;
  mappingConfidence: number;
}

export type StandardizationStatus = 
  | 'raw'
  | 'profiled'
  | 'cleaned'
  | 'extracted'
  | 'standardized'
  | 'validated'
  | 'common_master';

export type MatchStatus = 
  | 'unmatched'
  | 'candidate'
  | 'pending_review'
  | 'accepted'
  | 'rejected'
  | 'auto_accepted';

export interface MaterialFilters {
  page?: number;
  limit?: number;
  cpseId?: string;
  category?: string;
  materialType?: string;
  standardizationStatus?: StandardizationStatus;
  matchStatus?: MatchStatus;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}