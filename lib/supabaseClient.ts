import { createClient } from '@supabase/supabase-js';

// Secure credentials from environment bindings
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project-id.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key-token-here';

console.log('[Supabase Client Initialization] Detected Env URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);

// Self-healing: Strip trailing /rest/v1/ or /rest/v1 or trailing slashes
const sanitizedUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
console.log('[Supabase Client Initialization] Sanitized URL in use:', sanitizedUrl);

// Export unified, single client instance
export const supabase = createClient(sanitizedUrl, supabaseAnonKey);
console.log('[Supabase Client Initialization] Client created successfully:', !!supabase);

if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
}

