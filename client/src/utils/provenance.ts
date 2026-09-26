/**
 * Enterprise Source Provenance Resolver
 * Provides ERP source origin, plant/site, and ingestion metadata
 * for CPSE materials and candidate match comparisons.
 */

export interface ProvenanceInfo {
  erpSource: string;
  plantSite: string;
  batchId: string;
  sourceSystem: string;
}

const ERP_SYSTEM_MAP: Record<string, string> = {
  HPCL: 'HPCL SAP ERP',
  IOCL: 'IOCL SAP S/4HANA',
  ONGC: 'ONGC SAP ERP (SRM)',
  GAIL: 'GAIL SAP ERP',
  BHEL: 'BHEL SAP ECC 6.0',
  NTPC: 'NTPC SAP ERP',
  BPCL: 'BPCL SAP ERP',
  OIL: 'OIL Oracle ERP Cloud',
  SAIL: 'SAIL SAP ERP',
  CIL: 'CIL SAP ERP',
};

const PLANT_SITE_MAP: Record<string, string> = {
  HPCL: 'Mumbai Refinery / Stores Dept',
  IOCL: 'Mathura Refinery / Central Stores',
  ONGC: 'Mumbai Offshore / Asset Maintenance Base',
  GAIL: 'Pata Petrochemicals / Central Warehouse',
  BHEL: 'Bhopal Heavy Electricals / Factory Stores',
  NTPC: 'Singrauli Super Thermal / Warehouse Div',
  BPCL: 'Kochi Refinery / Maintenance Stores',
  OIL: 'Duliajan Field Operations / Central Stores',
  SAIL: 'Bhilai Steel Plant / Central Store',
  CIL: 'Ranchi Headquarters / Material Management',
};

export function resolveErpSource(cpseCode?: string, attributes?: Record<string, any>): string {
  const code = (cpseCode || 'CPSE').trim().toUpperCase();
  const baseSystem =
    attributes?.source_system ||
    ERP_SYSTEM_MAP[code] ||
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
  return PLANT_SITE_MAP[code] || `${code} Main Plant / Stores Dept`;
}

export function getFullProvenance(cpseCode?: string, attributes?: Record<string, any>): ProvenanceInfo {
  const code = (cpseCode || 'CPSE').trim().toUpperCase();
  const sourceSystem =
    attributes?.source_system ||
    ERP_SYSTEM_MAP[code] ||
    `${code} SAP ERP`;
  const batchId =
    attributes?.batch_id ||
    attributes?.upload_batch ||
    '2026-01';
  const plantSite = resolvePlantSite(code, attributes);

  return {
    erpSource: `${sourceSystem} / Upload Batch #${batchId.replace(/^Upload Batch #?/, '')}`,
    plantSite,
    batchId: batchId.replace(/^Upload Batch #?/, ''),
    sourceSystem,
  };
}
