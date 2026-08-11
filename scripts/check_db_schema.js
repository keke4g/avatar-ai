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

function request(path) {
  return new Promise((resolve) => {
    const options = {
      hostname: cleanedUrl,
      port: 443,
      path: path,
      method: 'GET',
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
        } catch {
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

async function checkSchema() {
  // Query OpenAPI root
  console.log('Fetching OpenAPI spec from /rest/v1/');
  const res = await request('/rest/v1/');
  console.log('Status code:', res.status);
  
  if (res.status === 200) {
    const spec = res.body;
    if (spec && spec.definitions && spec.definitions.properties) {
      const propertiesDef = spec.definitions.properties;
      console.log('Properties table definition properties keys:', Object.keys(propertiesDef.properties));
      fs.writeFileSync('properties_schema.json', JSON.stringify(propertiesDef, null, 2));
      console.log('Saved properties schema to properties_schema.json');
    } else {
      console.log('Could not find properties definition in spec. definitions keys:', Object.keys(spec?.definitions || {}));
    }
  } else {
    console.log('Error/No data from OpenAPI root:', res.body);
  }
}

checkSchema();
