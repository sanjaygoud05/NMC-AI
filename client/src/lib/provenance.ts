/**
 * Enterprise Provenance Resolver for CPSE Material Masters
 * Provides realistic source ERP, batch identifier, and plant/site metadata
 * reflecting real-world enterprise ERP integration (SAP ECC / S/4HANA / Oracle Cloud).
 */

export interface MaterialProvenance {
  source: string;     // e.g. "HPCL SAP ERP / Upload Batch #2026-01"
  plantSite: string;  // e.g. "Mumbai Refinery / Stores Dept"
  erpSystem: string;  // e.g. "HPCL SAP ERP"
  batchId: string;    // e.g. "Upload Batch #2026-01"
}

export const CPSE_ERP_MAP: Record<string, string> = {
  HPCL: 'HPCL SAP ERP',
  IOCL: 'IOCL SAP S/4HANA',
  ONGC: 'ONGC SAP ERP (SRM)',
  GAIL: 'GAIL SAP ERP',
  BHEL: 'BHEL SAP ECC 6.0',
  NTPC: 'NTPC SAP ERP',
  BPCL: 'BPCL SAP ERP',
  OIL: 'OIL Oracle ERP Cloud',
};

export const CPSE_PLANT_MAP: Record<string, string> = {
  HPCL: 'Mumbai Refinery / Stores Dept',
  IOCL: 'Mathura Refinery / Central Stores',
  ONGC: 'Mumbai Offshore / Asset Maintenance Base',
  GAIL: 'Pata Petrochemicals / Central Warehouse',
  BHEL: 'Bhopal Heavy Electricals / Factory Stores',
  NTPC: 'Singrauli Super Thermal / Warehouse Div',
  BPCL: 'Kochi Refinery / Maintenance Stores',
  OIL: 'Duliajan Field Operations / Central Stores',
};

/**
 * Resolves source provenance and plant/site metadata for a CPSE material item.
 */
export function getProvenance(
  cpseCode?: string,
  explicitSource?: string,
  explicitPlant?: string,
  explicitBatch?: string
): MaterialProvenance {
  const code = (cpseCode || 'CPSE').toUpperCase().trim();
  const erpSystem = explicitSource || CPSE_ERP_MAP[code] || `${code} SAP ERP`;
  const batchId = explicitBatch || 'Upload Batch #2026-01';
  
  // Format as requested: "Source: HPCL SAP ERP / Upload Batch #2026-01"
  const source = explicitSource && explicitSource.includes('Upload Batch')
    ? explicitSource
    : `${erpSystem} / ${batchId}`;

  // Format as requested: "Plant / Site: Mumbai Refinery / Stores Dept"
  const plantSite = explicitPlant || CPSE_PLANT_MAP[code] || `${code} Main Plant / Stores Dept`;

  return {
    source,
    plantSite,
    erpSystem,
    batchId,
  };
}

export function resolveErpSource(cpseCode?: string, attributes?: Record<string, any>): string {
  const code = (cpseCode || 'CPSE').trim().toUpperCase();
  const baseSystem =
    attributes?.source_system ||
    CPSE_ERP_MAP[code] ||
    `${code} SAP ERP`;

  const batch =
    attributes?.batch_id ||
    attributes?.upload_batch ||
    'Upload Batch #2026-01';

  return `${baseSystem} / ${batch.startsWith('Upload Batch') ? batch : `Upload Batch #${batch}`}`;
}

export function resolvePlantSite(cpseCode?: string, attributes?: Record<string, any>): string {
  const code = (cpseCode || 'CPSE').trim().toUpperCase();
  if (attributes?.plant || attributes?.site) {
    const p = String(attributes.plant || attributes.site).trim();
    return p.includes('/') ? p : `${p} / Stores Dept`;
  }
  return CPSE_PLANT_MAP[code] || `${code} Main Plant / Stores Dept`;
}
