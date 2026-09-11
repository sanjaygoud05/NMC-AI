/**
 * Central service exports for SIH26099
 * All API communication should go through these service modules.
 *
 * Architecture:
 *   React Components
 *     ↓
 *   TanStack Query hooks
 *     ↓
 *   Service Layer (this directory)
 *     ↓
 *   FastAPI backend
 */

export * from './materialService';
export * from './matchingService';
export * from './reviewService';
export * from './dashboardService';
export * from './cpseService';
export * from './ingestionService';
export * from './standardizationService';
export * from './procurementService';
export * from './evaluationService';
export * from './jobService';
export * from './commonMasterService';
export * from './legacyMappingService';