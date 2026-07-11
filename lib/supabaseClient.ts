import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project-id.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key-token-here';

// Accept both the project URL and an accidentally pasted REST endpoint.
const sanitizedUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');

export const supabase = createClient(sanitizedUrl, supabaseAnonKey);
