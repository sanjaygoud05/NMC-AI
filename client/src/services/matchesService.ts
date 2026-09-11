/**
 * Matches Service (Phase 5)
 * Re-exports matchingService functions and types for Phase 5 API interaction
 */

export * from './matchingService';
import { matchingService } from './matchingService';

export const matchesService = matchingService;
export default matchesService;
