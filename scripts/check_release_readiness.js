const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
        return [key, value];
      }),
  );
}

const projectRoot = path.resolve(__dirname, '..');
const localEnv = readEnvFile(path.join(projectRoot, '.env.local'));
const env = { ...localEnv, ...process.env };
const failures = [];

function requireValue(key, predicate, message) {
  const value = env[key]?.trim();
  if (!value || !predicate(value)) failures.push(`${key}: ${message}`);
}

if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
  failures.push('NODE_TLS_REJECT_UNAUTHORIZED: no puede ser 0; la verificación TLS está desactivada.');
}

requireValue(
  'NEXT_PUBLIC_PROPERTY_PROVIDER',
  (value) => value === 'supabase',
  'debe ser "supabase" para un lanzamiento con propiedades reales.',
);
requireValue(
  'NEXT_PUBLIC_SUPABASE_URL',
  (value) => /^https:\/\/[^/]+\.supabase\.co\/?$/.test(value) && !value.includes('placeholder'),
  'debe ser la URL HTTPS real del proyecto Supabase.',
);
requireValue(
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  (value) => value.length > 40 && !value.includes('placeholder'),
  'debe contener la clave pública real.',
);
requireValue(
  'NEXT_PUBLIC_APP_URL',
  (value) => /^https:\/\/[^/]+/.test(value) && !value.includes('localhost'),
  'debe ser la URL HTTPS canónica del sitio.',
);
requireValue(
  'NEXT_PUBLIC_LEGAL_CONTACT_EMAIL',
  (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !value.endsWith('.example'),
  'debe ser un correo legal/privacidad operativo, no un ejemplo.',
);

const requiredMigrations = [
  'supabase/migrations/20260728110000_harden_property_image_storage_paths.sql',
  'supabase/migrations/20260728120000_private_profiles_and_kyc_workflow.sql',
  'supabase/migrations/20260728123000_harden_property_inventory_publication.sql',
  'supabase/migrations/20260728200000_add_publisher_profiles_and_profile_avatars.sql',
  'supabase/migrations/20260728201000_enforce_publisher_profile_before_inventory.sql',
];

for (const migration of requiredMigrations) {
  if (!fs.existsSync(path.join(projectRoot, migration))) {
    failures.push(`${migration}: falta la migración de seguridad.`);
  }
}

if (failures.length > 0) {
  console.error('Release bloqueado por configuración incompleta:\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Configuración local válida. Verificando políticas del Supabase remoto…');
const securityVerification = spawnSync(
  process.execPath,
  [path.join(projectRoot, 'scripts', 'verify_security_hardening.js')],
  {
    cwd: projectRoot,
    env,
    stdio: 'inherit',
  },
);

if (securityVerification.status !== 0) {
  console.error('\nRelease bloqueado: las políticas de seguridad remotas no superaron la verificación.');
  process.exit(1);
}

console.log('Release readiness: configuración, migraciones y políticas remotas verificadas.');
