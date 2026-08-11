const fs = require('node:fs');
const crypto = require('node:crypto');

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((line) => /^\s*[^#=]+=.*/.test(line))
    .map((line) => {
      const separator = line.indexOf('=');
      let value = line.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      return [line.slice(0, separator).trim(), value];
    }),
);

const email = `account-deletion-${Date.now()}@example.com`;
const password = `${crypto.randomUUID()}Aa9!`;
const headers = {
  apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  'Content-Type': 'application/json',
};

async function authRequest(path, body) {
  const response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return { response, result: await response.json() };
}

async function main() {
  const signup = await authRequest('/auth/v1/signup', {
    email,
    password,
    data: { name: 'Account deletion test' },
  });
  if (!signup.response.ok || !signup.result.access_token) {
    throw new Error(`Test signup failed with ${signup.response.status}`);
  }

  const deletion = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`,
    {
      method: 'POST',
      headers: {
        ...headers,
        Authorization: `Bearer ${signup.result.access_token}`,
      },
      body: JSON.stringify({ confirmation: 'DELETE' }),
    },
  );
  const deletionResult = await deletion.json();
  if (!deletion.ok || deletionResult.deleted !== true) {
    throw new Error(`Deletion failed with ${deletion.status}`);
  }

  const login = await authRequest('/auth/v1/token?grant_type=password', {
    email,
    password,
  });
  if (login.response.ok) {
    throw new Error('The deleted account can still sign in');
  }

  console.log(
    JSON.stringify({
      signup: 'ok',
      deletion: 'ok',
      loginAfterDeletion: 'rejected',
    }),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
