const fs = require('node:fs');

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

const credentials = Object.fromEntries(
  fs
    .readFileSync('.secrets/play-reviewer-credentials.txt', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.includes(': '))
    .map((line) => line.split(/:\s+/, 2)),
);

async function main() {
  const response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: credentials.Email,
      password: credentials.Password,
      data: { name: 'Google Play Reviewer' },
    }),
  });

  const result = await response.json();
  const message = result.msg || result.message || result.error_description || null;
  console.log(
    JSON.stringify(
      {
        status: response.status,
        ok: response.ok,
        userId: result.user?.id,
        confirmed: Boolean(result.user?.confirmed_at),
        error: message,
      },
      null,
      2,
    ),
  );

  if (!response.ok && !/already registered/i.test(message || '')) {
    process.exitCode = 1;
    return;
  }

  const loginResponse = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: credentials.Email,
        password: credentials.Password,
      }),
    },
  );

  const loginResult = await loginResponse.json();
  console.log(
    JSON.stringify(
      {
        loginStatus: loginResponse.status,
        loginOk: loginResponse.ok,
        authenticatedUserId: loginResult.user?.id,
        error:
          loginResult.msg ||
          loginResult.message ||
          loginResult.error_description ||
          null,
      },
      null,
      2,
    ),
  );

  if (!loginResponse.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
