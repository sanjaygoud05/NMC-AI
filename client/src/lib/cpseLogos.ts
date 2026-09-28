export interface CPSEPreset {
  code: string;
  fullName: string;
  desc: string;
  logo: string;
}

export const CPSE_PRESETS: CPSEPreset[] = [
  {
    code: 'ONGC',
    fullName: 'Oil and Natural Gas Corporation Limited',
    desc: 'Oil and Natural Gas Corporation — Exploration & production of crude oil and natural gas',
    logo: '/cpse-logos/ongc.jpg',
  },
  {
    code: 'BPCL',
    fullName: 'Bharat Petroleum Corporation Limited',
    desc: 'Bharat Petroleum Corporation — Petroleum refining, distribution, and marketing enterprise',
    logo: '/cpse-logos/BPCL.png',
  },
  {
    code: 'IOCL',
    fullName: 'Indian Oil Corporation Limited',
    desc: 'Indian Oil Corporation — Refining, pipeline transportation, and marketing of petroleum products',
    logo: '/cpse-logos/iocl.jpg',
  },
  {
    code: 'HPCL',
    fullName: 'Hindustan Petroleum Corporation Limited',
    desc: 'Hindustan Petroleum Corporation — Petroleum refining, fuels, and lubricant marketing',
    logo: '/cpse-logos/hpcl.jpg',
  },
  {
    code: 'CPCL',
    fullName: 'Chennai Petroleum Corporation Limited',
    desc: 'Chennai Petroleum Corporation — Refining crude oil and petroleum fuels in South India',
    logo: '/cpse-logos/cpcl.png',
  },
  {
    code: 'NTPC',
    fullName: 'National Thermal Power Corporation (NTPC Limited)',
    desc: 'National Thermal Power Corporation — Power generation and energy utility operations',
    logo: '/cpse-logos/ntpc.svg',
  },
  {
    code: 'SAIL',
    fullName: 'Steel Authority of India Limited',
    desc: 'Steel Authority of India — Integrated steel manufacturing and metallurgy public enterprise',
    logo: '/cpse-logos/sail.PNG',
  },
  {
    code: 'GAIL',
    fullName: 'Gas Authority of India Limited (GAIL India)',
    desc: 'Gas Authority of India — Natural gas transmission, processing, and petrochemicals',
    logo: '/cpse-logos/GAIL.png',
  },
  {
    code: 'HAL',
    fullName: 'Hindustan Aeronautics Limited',
    desc: 'Hindustan Aeronautics Limited — Aerospace, defense manufacturing, and avionics enterprise',
    logo: '/cpse-logos/HAL.png',
  },
];

export function getCpseLogo(code?: string | null, name?: string | null): string | null {
  if (!code && !name) return null;
  const cleanCode = (code || '').toUpperCase().split('-')[0].trim();
  const matched = CPSE_PRESETS.find(
    (p) =>
      p.code.toUpperCase() === cleanCode ||
      p.code.toUpperCase() === (code || '').toUpperCase() ||
      (name && p.fullName.toLowerCase() === name.toLowerCase())
  );
  return matched?.logo || null;
}
