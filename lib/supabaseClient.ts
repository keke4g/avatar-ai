import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project-id.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key-token-here';

// Accept both the project URL and an accidentally pasted REST endpoint.
const sanitizedUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');

export const supabase = createClient(sanitizedUrl, supabaseAnonKey, {
  auth: {
    // Authorization Code + PKCE keeps the OAuth exchange bound to the browser
    // that initiated it. The verifier is persisted in the WebView for the
    // Android custom-tab flow and in the browser for the regular web flow.
    flowType: 'pkce',
    // OAuth and password-recovery pages exchange the code explicitly. Keeping
    // automatic URL detection enabled races those pages and can consume the
    // one-time code before their effects run.
    detectSessionInUrl: false,
    persistSession: true,
    autoRefreshToken: true,
  },
});
