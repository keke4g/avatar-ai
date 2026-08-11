const fs = require('fs');
const path = require('path');
const https = require('https');

const envPath = path.resolve(__dirname, '../.env.local');
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (error) {
  console.error('Failed to read .env.local', error);
  process.exit(1);
}

const env = {};
envContent.split(/\r?\n/).forEach((line) => {
  const separator = line.indexOf('=');
  if (separator <= 0 || line.trimStart().startsWith('#')) return;
  const key = line.slice(0, separator).trim();
  const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
  env[key] = value;
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const authenticatedToken =
  env.SECURITY_TEST_USER_ACCESS_TOKEN ||
  process.env.SECURITY_TEST_USER_ACCESS_TOKEN ||
  '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key not found in .env.local');
  process.exit(1);
}

const cleanedUrl = supabaseUrl
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/$/, '')
  .replace('https://', '');

function decodeJwtSubject(token) {
  try {
    const payload = token.split('.')[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8')).sub || '';
  } catch {
    return '';
  }
}

function request({
  endpoint,
  method = 'GET',
  token = supabaseAnonKey,
  body
}) {
  return new Promise((resolve) => {
    const serializedBody = body === undefined ? '' : JSON.stringify(body);
    const options = {
      hostname: cleanedUrl,
      port: 443,
      path: endpoint,
      method,
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    };

    if (serializedBody) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(serializedBody);
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
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

    req.on('error', (error) => {
      resolve({ status: 'fetch_error', body: error.message });
    });
    if (serializedBody) req.write(serializedBody);
    req.end();
  });
}

function isDeniedOrEmpty(response) {
  return response.status === 401 ||
    response.status === 403 ||
    (response.status === 200 &&
      Array.isArray(response.body) &&
      response.body.length === 0);
}

function containsForbiddenColumns(rows, forbiddenColumns) {
  if (!Array.isArray(rows)) return false;
  return rows.some((row) =>
    row &&
    forbiddenColumns.some((column) =>
      Object.prototype.hasOwnProperty.call(row, column)
    )
  );
}

const forbiddenProfileColumns = [
  'email',
  'phone',
  'phone_number',
  'whatsapp',
  'address',
  'identity_document',
  'document_number'
];

const anonymousTests = [
  {
    name: 'Anonymous cannot enumerate profile rows or email',
    request: {
      endpoint: '/rest/v1/profiles?select=id,email&limit=20'
    },
    validate: isDeniedOrEmpty,
    success: 'SECURE (base profile rows and email are unavailable)'
  },
  {
    name: 'Sanitized public profiles view remains readable',
    request: {
      endpoint: '/rest/v1/public_profiles_view?select=*&limit=20'
    },
    validate: (response) =>
      response.status === 200 &&
      !containsForbiddenColumns(response.body, forbiddenProfileColumns),
    success: 'SECURE (public DTO is readable and contains no private columns)'
  },
  {
    name: 'Main properties table direct read',
    request: {
      endpoint: '/rest/v1/properties?select=*&limit=1'
    },
    validate: isDeniedOrEmpty,
    success: 'SECURE (direct property table read is restricted)'
  },
  {
    name: 'Sanitized public properties view',
    request: {
      endpoint: '/rest/v1/public_properties_view?select=*&limit=1'
    },
    validate: (response) => response.status === 200,
    success: 'SECURE (public property DTO is readable)'
  },
  {
    name: 'Anonymous cannot enumerate KYC request metadata',
    request: {
      endpoint: '/rest/v1/kyc_requests?select=*&limit=20'
    },
    validate: isDeniedOrEmpty,
    success: 'SECURE (KYC request metadata is private)'
  },
  {
    name: 'Anonymous cannot enumerate publisher contact profiles',
    request: {
      endpoint: '/rest/v1/publisher_profiles?select=*&limit=20'
    },
    validate: isDeniedOrEmpty,
    success: 'SECURE (publisher contact details are private)'
  },
  {
    name: 'Anonymous cannot list the private KYC bucket',
    request: {
      endpoint: '/storage/v1/object/list/kyc-documents',
      method: 'POST',
      body: { prefix: '', limit: 20, offset: 0 }
    },
    validate: isDeniedOrEmpty,
    success: 'SECURE (private KYC objects cannot be listed)'
  },
  {
    name: 'Anonymous cannot list profile avatar objects',
    request: {
      endpoint: '/storage/v1/object/list/profile-avatars',
      method: 'POST',
      body: { prefix: '', limit: 20, offset: 0 }
    },
    validate: isDeniedOrEmpty,
    success: 'SECURE (profile avatar storage cannot be enumerated)'
  },
  {
    name: 'Private property document metadata',
    request: {
      endpoint: '/rest/v1/property_documents?select=*&limit=1'
    },
    validate: isDeniedOrEmpty,
    success: 'SECURE (private property documents are unavailable)'
  },
  {
    name: 'Private audit logs',
    request: {
      endpoint: '/rest/v1/audit_logs?select=*&limit=1'
    },
    validate: isDeniedOrEmpty,
    success: 'SECURE (audit logs are unavailable)'
  }
];

function authenticatedTests(token) {
  const subject = decodeJwtSubject(token);
  if (!subject) {
    return {
      subject,
      tests: []
    };
  }

  return {
    subject,
    tests: [
      {
        name: 'Authenticated user only sees their own base profile',
        request: {
          endpoint: '/rest/v1/profiles?select=id,email&limit=20',
          token
        },
        validate: (response) =>
          response.status === 200 &&
          Array.isArray(response.body) &&
          response.body.every((profile) => profile.id === subject),
        success: 'SECURE (base profile access is scoped to the JWT subject)'
      },
      {
        name: 'Authenticated user only sees their own KYC requests',
        request: {
          endpoint: '/rest/v1/kyc_requests?select=id,user_id,status&limit=20',
          token
        },
        validate: (response) =>
          response.status === 200 &&
          Array.isArray(response.body) &&
          response.body.every((kycRequest) => kycRequest.user_id === subject),
        success: 'SECURE (KYC metadata is owner-scoped)'
      },
      {
        name: 'Authenticated user only sees their publisher contact profile',
        request: {
          endpoint: '/rest/v1/publisher_profiles?select=user_id,contact_email,phone,whatsapp&limit=20',
          token
        },
        validate: (response) =>
          response.status === 200 &&
          Array.isArray(response.body) &&
          response.body.every((profile) => profile.user_id === subject),
        success: 'SECURE (publisher contact access is owner-scoped)'
      },
      {
        name: 'Authenticated user only lists their own KYC folder',
        request: {
          endpoint: '/storage/v1/object/list/kyc-documents',
          method: 'POST',
          token,
          body: { prefix: '', limit: 100, offset: 0 }
        },
        validate: (response) =>
          response.status === 200 &&
          Array.isArray(response.body) &&
          response.body.every((object) =>
            typeof object.name === 'string' &&
            object.name.startsWith(`${subject}/`)
          ),
        success: 'SECURE (KYC Storage listing is owner-scoped)'
      },
      {
        name: 'Authenticated user only lists their own avatar folder',
        request: {
          endpoint: '/storage/v1/object/list/profile-avatars',
          method: 'POST',
          token,
          body: { prefix: '', limit: 100, offset: 0 }
        },
        validate: (response) =>
          response.status === 200 &&
          Array.isArray(response.body) &&
          response.body.every((object) =>
            typeof object.name === 'string' &&
            object.name.startsWith(`${subject}/`)
          ),
        success: 'SECURE (profile avatar listing is owner-scoped)'
      }
    ]
  };
}

async function runTests(testCases) {
  let passedAll = true;

  for (const testCase of testCases) {
    const response = await request(testCase.request);
    const passed = testCase.validate(response);

    console.log(`[TEST] ${testCase.name}`);
    console.log(`  - Endpoint: ${testCase.request.endpoint}`);
    console.log(`  - HTTP Status: ${response.status}`);
    console.log(`  - STATUS: ${passed ? testCase.success : 'FAILED (policy or projection is unsafe)'}`);

    if (Array.isArray(response.body) && response.body[0]) {
      console.log(`  - Returned columns: ${Object.keys(response.body[0]).join(', ')}`);
    }
    console.log('');

    if (!passed) passedAll = false;
  }

  return passedAll;
}

async function run() {
  console.log('==============================================================');
  console.log('AURASWAP SECURITY HARDENING VERIFICATION REPORT');
  console.log('==============================================================');
  console.log(`Supabase URL: https://${cleanedUrl}`);
  console.log('--------------------------------------------------------------\n');
  console.log('ANONYMOUS ACCESS');
  console.log('--------------------------------------------------------------\n');

  let passedAll = await runTests(anonymousTests);

  console.log('AUTHENTICATED ACCESS');
  console.log('--------------------------------------------------------------\n');

  if (authenticatedToken) {
    const authenticated = authenticatedTests(authenticatedToken);
    if (!authenticated.subject) {
      console.log('[CONFIG] SECURITY_TEST_USER_ACCESS_TOKEN is not a valid JWT.');
      passedAll = false;
    } else {
      console.log(`JWT subject under test: ${authenticated.subject}\n`);
      const authenticatedPassed = await runTests(authenticated.tests);
      passedAll = passedAll && authenticatedPassed;
    }
  } else {
    console.log(
      '[SKIPPED] Set SECURITY_TEST_USER_ACCESS_TOKEN in the environment or ' +
      '.env.local to verify authenticated owner scoping.\n'
    );
  }

  console.log('==============================================================');
  if (passedAll) {
    console.log('VERIFICATION: SUCCESS! Executed security checks passed.');
  } else {
    console.log('VERIFICATION: FAILURE! One or more security checks failed.');
    process.exitCode = 1;
  }
  console.log('==============================================================');
}

run().catch((error) => {
  console.error('Security verification failed unexpectedly:', error);
  process.exitCode = 1;
});
