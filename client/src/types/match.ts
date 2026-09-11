/**
 * Matching Domain Types for SIH26099
 * Represents material matching and harmonization logic
 */

import type { Material } from './material';

export interface MaterialMatch {
  id: string;
  sourceMaterialId: string;
  candidateMaterialId: string;
  semanticScore: number;
  fuzzyScore: number;
  attributeScore: number;
  confidenceScore: number;
  decision: MatchDecision;
  matchReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MatchCandidate {
  materialId: string;
  candidateId: string;
  sourceMaterial: Material;
  candidateMaterial: Material;
  scores: MatchScores;
  confidence: number;
  recommendation: MatchRecommendation;
  explanation: string[];
}

export interface MatchScores {
  semantic: number;
  fuzzy: number;
  attribute: number;
  combined: number;
}

export type MatchDecision = 
  | 'candidate'
  | 'accepted'
  | 'rejected'
  | 'review';

export type MatchRecommendation = 
  | 'high_confidence'
  | 'medium_confidence'
  | 'low_confidence'
  | 'manual_review';

export interface SimilarityScore {
  score: number;
  method: 'semantic' | 'fuzzy' | 'attribute' | 'combined';
  threshold: number;
  passed: boolean;
}

export interface AttributeComparison {
  attributeName: string;
  sourceValue: string;
  candidateValue: string;
  similarity: number;
  match: boolean;
}

export interface MatchExplanation {
  summary: string;
  keyFactors: string[];
  confidenceBreakdown: {
    semantic: number;
    fuzzy: number;
    attribute: number;
  };
  recommendations: string[];
}