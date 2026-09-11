/**
 * Procurement Domain Types for SIH26099
 * Represents procurement intelligence and consolidation opportunities
 */

export interface ProcurementInsight {
  id: string;
  commonMaterialId: string;
  commonCode: string;
  commonDescription: string;
  category: string;
  totalAnnualDemand: number;
  totalAnnualValue: number;
  cpseCount: number;
  consolidationOpportunity: ConsolidationLevel;
  potentialSavings: number;
  savingsPercentage: number;
  recommendedAction: string;
  riskFactors: string[];
}

export interface ConsolidationOpportunity {
  materialId: string;
  materialCode: string;
  commonDescription: string;
  currentSuppliers: number;
  totalSpend: number;
  unitPriceVariance: number;
  qualityVariance: number;
  leadTimeVariance: number;
  consolidationPotential: number;
  implementationComplexity: 'low' | 'medium' | 'high';
  timeToImplement: number;
}

export interface DemandChart {
  materialId: string;
  timeSeries: DemandDataPoint[];
  seasonality: SeasonalityPattern;
  forecast: DemandForecast;
}

export interface DemandDataPoint {
  period: string;
  demand: number;
  cpseBreakdown: CPSEDemand[];
}

export interface CPSEDemand {
  cpseId: string;
  cpseName: string;
  demand: number;
  percentage: number;
}

export interface SeasonalityPattern {
  pattern: 'none' | 'monthly' | 'quarterly' | 'annual';
  peakPeriod: string;
  peakMultiplier: number;
}

export interface DemandForecast {
  nextPeriod: number;
  nextQuarter: number;
  nextYear: number;
  confidence: number;
  method: string;
}

export type ConsolidationLevel = 
  | 'high'
  | 'medium'
  | 'low'
  | 'none';