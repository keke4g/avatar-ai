const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const anonKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

async function run() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  
  console.log('Fetching catalog_conservation_states...');
  const res1 = await fetch(`${supabaseUrl}/rest/v1/catalog_conservation_states`, {
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`
    }
  });
  const data1 = await res1.json();
  console.log('States:', data1);

  console.log('Fetching catalog_construction_types...');
  const res2 = await fetch(`${supabaseUrl}/rest/v1/catalog_construction_types`, {
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`
    }
  });
  const data2 = await res2.json();
  console.log('Types:', data2);
}

run();
