const fs = require('fs');
const path = require('path');
const https = require('https');

// Load environment variables from .env.local
const envPath = path.resolve(__dirname, '../.env.local');
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (e) {
  console.error('Failed to read .env.local', e);
  process.exit(1);
}

const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key not found in .env.local');
  process.exit(1);
}

const cleanedUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '').replace('https://', '');

function request(path, method = 'OPTIONS') {
  return new Promise((resolve) => {
    const options = {
      hostname: cleanedUrl,
      port: 443,
      path: path,
      method: method,
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({ status: res.statusCode, body: parsed });
      });
    });

    req.on('error', (e) => {
      resolve({ status: 'fetch_error', body: e.message });
    });
    req.end();
  });
}

async function audit() {
  console.log('Sending OPTIONS request to /rest/v1/properties...');
  const res = await request('/rest/v1/properties', 'OPTIONS');
  console.log('Status code:', res.status);
  
  if (res.status === 200) {
    fs.writeFileSync('properties_options.json', JSON.stringify(res.body, null, 2));
    console.log('Successfully saved OPTIONS info to properties_options.json');
  } else {
    console.log('Error from OPTIONS request:', res.body);
  }
}

audit();
