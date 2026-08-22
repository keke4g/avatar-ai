import 'server-only';

type RateLimitPolicy = {
  limit: number;
  windowMs: number;
  maxBodyBytes?: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type AuthenticatedUser = {
  id: string;
  email?: string;
};

declare global {
  // Best-effort application limiter. The Vercel WAF remains the distributed
  // enforcement layer; this store protects each warm function instance too.
  var __towersRateLimits: Map<string, RateLimitEntry> | undefined;
}

const rateLimits = globalThis.__towersRateLimits ?? new Map<string, RateLimitEntry>();
globalThis.__towersRateLimits = rateLimits;

function errorResponse(message: string, status: number, headers?: HeadersInit) {
  return Response.json(
    { error: message },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        ...headers,
      },
    },
  );
}

function getClientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const direct = request.headers.get('x-real-ip')?.trim();
  const identifier = (forwarded || direct || 'unknown').slice(0, 96);
  return `${new URL(request.url).pathname}:${identifier}`;
}

export function guardRequest(request: Request, policy: RateLimitPolicy): Response | null {
  const contentLength = Number(request.headers.get('content-length'));
  if (
    policy.maxBodyBytes
    && Number.isFinite(contentLength)
    && contentLength > policy.maxBodyBytes
  ) {
    return errorResponse('La petición supera el tamaño permitido.', 413);
  }

  const now = Date.now();
  const key = getClientKey(request);
  const current = rateLimits.get(key);
  const entry = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + policy.windowMs }
    : current;
  entry.count += 1;
  rateLimits.set(key, entry);

  if (rateLimits.size > 5_000) {
    for (const [storedKey, storedEntry] of rateLimits) {
      if (storedEntry.resetAt <= now) rateLimits.delete(storedKey);
    }
  }

  if (entry.count <= policy.limit) return null;

  const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1_000));
  return errorResponse('Demasiadas peticiones. Intenta de nuevo más tarde.', 429, {
    'Retry-After': String(retryAfter),
    'X-RateLimit-Limit': String(policy.limit),
    'X-RateLimit-Remaining': '0',
    'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1_000)),
  });
}

export async function readJsonObject(
  request: Request,
  maxBodyBytes: number,
): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type')?.toLowerCase() || '';
  if (!contentType.startsWith('application/json')) {
    throw new RequestInputError('El contenido debe enviarse como application/json.', 415);
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBodyBytes) {
    throw new RequestInputError('La petición supera el tamaño permitido.', 413);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new RequestInputError('El cuerpo de la petición debe ser JSON válido.', 400);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new RequestInputError('El cuerpo de la petición no es válido.', 400);
  }
  return parsed as Record<string, unknown>;
}

export class RequestInputError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'RequestInputError';
  }
}

export function inputErrorResponse(error: unknown): Response | null {
  if (!(error instanceof RequestInputError)) return null;
  return errorResponse(error.message, error.status);
}

export async function requireAuthenticatedUser(
  request: Request,
): Promise<{ user: AuthenticatedUser; token: string } | { response: Response }> {
  const match = request.headers.get('authorization')?.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) {
    return { response: errorResponse('Debes iniciar sesión para continuar.', 401) };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return { response: errorResponse('La autenticación no está configurada.', 503) };
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${match[1]}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      return { response: errorResponse('La sesión no es válida o expiró.', 401) };
    }

    const user = await response.json() as Partial<AuthenticatedUser>;
    if (!user.id || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(user.id)) {
      return { response: errorResponse('La sesión no es válida o expiró.', 401) };
    }
    return { user: { id: user.id, email: user.email }, token: match[1] };
  } catch {
    return { response: errorResponse('No fue posible validar la sesión.', 503) };
  }
}

export function normalizePlainText(value: string, maxLength: number): string {
  return value
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}
