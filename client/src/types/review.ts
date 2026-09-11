/**
 * Review Domain Types for SIH26099
 * Represents human review workflow for material matching
 */

import type { MaterialMatch, AttributeComparison, MatchCandidate } from './match';
import type { Material } from './material';

export interface ReviewItem {
  id: string;
  matchId: string;
  sourceMaterialId: string;
  candidateMaterialId: string;
  priority: ReviewPriority;
  status: ReviewStatus;
  assignedTo?: string;
  assignedAt?: string;
  decision?: ReviewDecision;
  decisionComment?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewHistory {
  id: string;
  matchId: string;
  action: ReviewAction;
  previousDecision?: ReviewDecision;
  newDecision: ReviewDecision;
  comment: string;
  performedBy: string;
  performedAt: string;
}

export interface ReviewPanel {
  reviewItem: ReviewItem;
  match: MaterialMatch;
  sourceMaterial: Material;
  candidateMaterial: Material;
  attributeComparisons: AttributeComparison[];
  similarCandidates: MatchCandidate[];
  history: ReviewHistory[];
}

export type ReviewPriority = 
  | 'critical'
  | 'high'
  | 'medium'
  | 'low';

export type ReviewStatus = 
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'skipped';

export type ReviewAction = 
  | 'assigned'
  | 'started'
  | 'accepted'
  | 'rejected'
  | 'requested_changes'
  | 'escalated'
  | 'completed';

export type ReviewDecision = 
  | 'accept'
  | 'reject'
  | 'request_changes'
  | 'escalate'
  | 'skip';