import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://hlhiizhzhjhodvllrvmb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsaGlpemh6aGpob2R2bGxydm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMzk1ODcsImV4cCI6MjEwNDcxNTU4N30.3PEbvaIEbLXAiWGgvp8UWYUtxXP2SQsw21Ocg710OFo';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

