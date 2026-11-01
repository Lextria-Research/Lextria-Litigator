// src/lib/supabase.ts
// Supabase client configured with the mandatory x-lextria-app: LITIGATOR header.
// Provides isolated schema accessors for 'litigator' and 'core'.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.SUPABASE_URL ||
  'https://eafciegebhuhoneypsqy.supabase.co';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhZmNpZWdlYmh1aG9uZXlwc3F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwOTU1NTcsImV4cCI6MjEwNjY3MTU1N30.u1pqpPamztil2qaTaY7EahBaiWduVaQ3Wgu2_9CdJlg';

export const DATA_MODE =
  import.meta.env.VITE_DATA_MODE ||
  import.meta.env.DATA_MODE ||
  'supabase';

export const isSupabaseConfigured = Boolean(
  supabaseAnonKey && supabaseAnonKey !== 'mock-anon-key-for-local-dev'
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      'x-lextria-app': 'LITIGATOR',
    },
  },
});

export const litigatorDb = supabase.schema('litigator');
export const coreDb = supabase.schema('core');
export const financeDb = supabase.schema('finance');
