/**
 * Standardization API Service
 * Communicates with Phase 3 attribute extraction endpoints
 */

import { API_BASE } from './apiConfig';

export interface AttributeCoverage {
  material_family: number;
  material_type: number;
  material_subtype: number;
  material: number;
  material_grade: number;
  size: number;
  diameter: number;
  length: number;
  pressure_class: number;
  schedule: number;
  standard: number;
  coating: number;
  connection_type: number;
  construction: number;
  orientation: number;
  bearing_number: number;
}

export interface ExtractionReport {
  phase: string;
  dataset_rows: number;
  records_processed: number;
  records_with_attributes: number;
  records_without_attributes: number;
  records_1_plus_attributes: number;
  records_3_plus_attributes: number;
  records_5_plus_attributes: number;
  average_attributes_per_record: number;
  attribute_coverage: AttributeCoverage;
  rule_application_counts: Record<string, number>;
  source_counts: Record<string, number>;
  confidence_counts: { high: number; medium: number; low: number };
  total_conflicts: number;
  raw_dataset_unchanged: boolean;
}

export interface ExtractionStatus {
  status: 'not_run' | 'completed' | 'failed';
  extracted_file_exists: boolean;
  message?: string;
  report?: ExtractionReport;
}

export interface MaterialAttributes {
  material_code: string;
  original_fields: Record<string, string | null>;
  extracted_attributes: Record<string, string | null>;
  audit: Record<string, string | null>;
}

export interface StandardizationExample {
  material_code: string;
  original_description: string;
  phase3_extracted: Record<string, string>;
  standardized_description: string;
  canonical_material_key: string;
  rules_applied: string | null;
  conflict_preserved: boolean;
}

export interface StandardizationReport {
  phase: string;
  dataset: {
    input_rows: number;
    output_rows: number;
    input_columns: number;
    output_columns: number;
  };
  standardization: {
    records_processed: number;
    records_changed: number;
    records_unchanged: number;
    change_rate: number;
  };
  canonical_keys: {
    total_records: number;
    unique_canonical_keys: number;
    records_with_unique_keys: number;
    records_sharing_canonical_key: number;
  };
  conflicts: {
    records_with_preserved_conflicts: number;
    conflicts_resolved: number;
    conflict_types: Record<string, number>;
  };
  rule_usage: Array<{ rule_id: string; count: number }>;
  attribute_impact: Record<string, {
    input_unique_values: number;
    output_unique_values: number;
    changed_count: number;
  }>;
  examples: StandardizationExample[];
}

export interface StandardizedMaterialDetail {
  material_code: string;
  original_fields: Record<string, string | null>;
  extracted_attributes: Record<string, string | null>;
  canonical_attributes: Record<string, string | null>;
  standardization: {
    standardized_description: string;
    canonical_material_key: string;
    standardization_changed: boolean;
    standardization_rule_count: number;
    standardization_rules_applied: string | null;
    conflict_preserved: boolean;
    conflict_detail: string | null;
  };
}

export const standardizationService = {
  async getAttributesSummary(datasetId?: string): Promise<ExtractionStatus> {
    try {
      const q = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
      const res = await fetch(`${API_BASE}/api/standardization/attributes${q}`);
      if (res.ok) return await res.json();
    } catch { /* fallback */ }
    return { status: 'not_run', extracted_file_exists: false, message: 'Could not load extraction status' };
  },

  async getAttributesReport(): Promise<ExtractionReport | null> {
    try {
      const res = await fetch(`${API_BASE}/api/standardization/attributes/report`);
      if (res.ok) return await res.json();
    } catch { /* fallback */ }
    return null;
  },

  async getMaterialAttributes(materialCode: string): Promise<MaterialAttributes | null> {
    try {
      const res = await fetch(`${API_BASE}/api/standardization/attributes/${encodeURIComponent(materialCode)}`);
      if (res.ok) return await res.json();
    } catch { /* fallback */ }
    return null;
  },

  async runExtraction(): Promise<{ status: string; result?: unknown }> {
    const res = await fetch(`${API_BASE}/api/standardization/extract-attributes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) return await res.json();
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || 'Extraction failed');
  },

  async getStandardizationReport(datasetId?: string): Promise<StandardizationReport | null> {
    try {
      const q = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
      const res = await fetch(`${API_BASE}/api/standardization/report${q}`);
      if (res.ok) return await res.json();
    } catch { /* fallback */ }
    return null;
  },

  async getStandardizedMaterial(materialCode: string): Promise<StandardizedMaterialDetail | null> {
    try {
      const res = await fetch(`${API_BASE}/api/standardization/materials/${encodeURIComponent(materialCode)}`);
      if (res.ok) return await res.json();
    } catch { /* fallback */ }
    return null;
  },

  async runStandardization(): Promise<{ status: string; result?: unknown }> {
    const res = await fetch(`${API_BASE}/api/standardization/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) return await res.json();
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || 'Standardization pipeline execution failed');
  },
};
