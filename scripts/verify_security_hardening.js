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

const testCases = [
  {
    name: 'Main profiles table select direct read',
    path: '/rest/v1/profiles?select=*&limit=1',
    expectSecure: true // True if we expect it to return 401/403 or empty array, false if it returns data
  },
  {
    name: 'Main properties table select direct read',
    path: '/rest/v1/properties?select=*&limit=1',
    expectSecure: true
  },
  {
    name: 'Sanitised public properties view',
    path: '/rest/v1/public_properties_view?select=*&limit=1',
    expectSecure: false // Should succeed (200 OK)
  },
  {
    name: 'Sanitised public profiles view',
    path: '/rest/v1/public_profiles_view?select=*&limit=1',
    expectSecure: false // Should succeed (200 OK)
  },
  {
    name: 'Private document storage metadata table',
    path: '/rest/v1/property_documents?select=*&limit=1',
    expectSecure: true
  },
  {
    name: 'Private audit logs table',
    path: '/rest/v1/audit_logs?select=*&limit=1',
    expectSecure: true
  }
];

async function run() {
  console.log('==============================================================');
  console.log('AURASWAP SECURITY HARDENING VERIFICATION REPORT');
  console.log('==============================================================');
  console.log(`Supabase URL: https://${cleanedUrl}`);
  console.log('--------------------------------------------------------------\n');

  let passedAll = true;

  for (const tc of testCases) {
    const res = await request(tc.path);
    const hasData = Array.isArray(res.body) && res.body.length > 0;
    
    // Check if the result matches our expectations for a hardened database
    let isSecure = false;
    if (tc.expectSecure) {
      // It is secure if the request fails (401/403) or returns an empty list (due to RLS restriction)
      isSecure = (res.status === 401 || res.status === 403 || (res.status === 200 && !hasData));
    } else {
      // It is secure if the request succeeds and returns data or empty array without authorization errors
      isSecure = (res.status === 200);
    }

    console.log(`[TEST] ${tc.name}`);
    console.log(`  - Endpoint: ${tc.path}`);
    console.log(`  - HTTP Status: ${res.status}`);
    
    if (tc.expectSecure) {
      if (isSecure) {
        console.log('  - STATUS: SECURE (Direct select restricted or empty)');
      } else {
        console.log('  - STATUS: VULNERABLE (Returns data directly via public API)');
        passedAll = false;
      }
    } else {
      if (isSecure) {
        console.log('  - STATUS: SUCCESS (Public view is readable)');
      } else {
        console.log('  - STATUS: FAILURE (Public view not readable or not created)');
        passedAll = false;
      }
    }
    
    if (hasData) {
      console.log('  - Exposes columns:', Object.keys(res.body[0]).join(', '));
    }
    console.log('');
  }

  console.log('==============================================================');
  if (passedAll) {
    console.log('VERIFICATION: SUCCESS! All security hardening policies are active.');
  } else {
    console.log('VERIFICATION: WARNING! Some vulnerabilities are still active.');
    console.log('Please copy and execute the consolidated SQL migration script in your Supabase SQL editor.');
  }
  console.log('==============================================================');
}

run();
