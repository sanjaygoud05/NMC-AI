import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// The verified live Supabase project for NMC-AI
const LIVE_SUPABASE_URL = 'https://hlhiizhzhjhodvllrvmb.supabase.co';
const LIVE_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsaGlpemh6aGpob2R2bGxydm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMzk1ODcsImV4cCI6MjEwNDcxNTU4N30.3PEbvaIEbLXAiWGgvp8UWYUtxXP2SQsw21Ocg710OFo';

const envUrl = import.meta.env.VITE_SUPABASE_URL;
// Filter out dead/deleted project domains (e.g. xukedepkwhgqrmdoyrvn, placeholder-project)
const SUPABASE_URL =
  envUrl &&
  !envUrl.includes('xukedepkwhgqrmdoyrvn') &&
  !envUrl.includes('placeholder-project')
    ? envUrl
    : LIVE_SUPABASE_URL;

const envKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_PUBLISHABLE_KEY =
  envKey &&
  !envKey.includes('placeholder-anon-key') &&
  envKey.length > 50 &&
  SUPABASE_URL === envUrl
    ? envKey
    : LIVE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

