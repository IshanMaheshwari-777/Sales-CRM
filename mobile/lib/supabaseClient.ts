import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Expo Supabase environment variables');
}

export const mobileSupabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
