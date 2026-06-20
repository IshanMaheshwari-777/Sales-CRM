import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const envFile = fs.readFileSync('.env', 'utf8');
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1];
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: statuses } = await supabase.from('lead_statuses').select('*');
  const { data: leads } = await supabase.from('leads').select('status_id');
  
  const counts = {};
  leads.forEach(l => {
    counts[l.status_id] = (counts[l.status_id] || 0) + 1;
  });
  
  console.log('Total Leads:', leads.length);
  statuses.forEach(s => {
    console.log(`Status: ${s.name} (${s.id}) - Count: ${counts[s.id] || 0}`);
  });
}
main();
