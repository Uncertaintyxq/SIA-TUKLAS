/**
 * API client — the fetch helpers every API hook uses to talk to the Laravel API.
 * The session rides in an httpOnly cookie (Sanctum SPA auth). Every write also sends the
 * XSRF-TOKEN cookie back as the X-XSRF-TOKEN header, which Laravel checks against the session.
 * Failed requests throw ApiError with the server's message and HTTP status.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Machine-readable reason, e.g. "email_unverified" or "two_factor_required". */
    readonly code?: string,
    /** Field-level validation messages, keyed by field name. */
    readonly issues?: Record<string, string[]>,
  ) {
    super(message);
  }
}

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
/** Laravel's "CSRF token mismatch" status: the session expired or the cookie is missing. */
const CSRF_EXPIRED = 419;

function xsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
  return match ? decodeURIComponent(match[1]!) : null;
}

/** Asks Laravel to set a fresh XSRF-TOKEN cookie. */
async function refreshCsrf(): Promise<void> {
  await fetch('/sanctum/csrf-cookie', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
}

/** Sends one request with the JSON and CSRF headers; on a write, retries once if the token expired. */
async function send(path: string, method: string, headers: Record<string, string>, body: BodyInit | undefined): Promise<Response> {
  const write = !SAFE.has(method);
  if (write && !xsrfToken()) await refreshCsrf();
  const attempt = () => {
    const token = write ? xsrfToken() : null;
    return fetch(`/api${path}`, {
      method,
      headers: { Accept: 'application/json', ...(token ? { 'X-XSRF-TOKEN': token } : {}), ...headers },
      body,
      credentials: 'same-origin',
    });
  };
  const res = await attempt();
  if (!write || res.status !== CSRF_EXPIRED) return res;
  await refreshCsrf();
  return attempt();
}

/** JSON fetch against our own `/api`. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await send(
      path,
      init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      init.body === undefined ? {} : { 'Content-Type': 'application/json' },
      init.body === undefined ? undefined : JSON.stringify(init.body),
    );
  } catch {
    throw new ApiError('Can’t reach Tuklas right now. Check your connection and try again.', 0);
  }
  return read<T>(res);
}

async function read<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? 'Something went wrong. Please try again.', res.status, data.code, data.issues);
  return data as T;
}

/** Sends a file as the raw request body, with its name in a header. The server checks the bytes. */
export async function upload<T = void>(path: string, file: File, method: 'PUT' | 'POST' = 'PUT'): Promise<T> {
  let res: Response;
  try {
    res = await send(path, method, { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) }, file);
  } catch {
    throw new ApiError('The upload didn’t reach Tuklas. Check your connection and try again.', 0);
  }
  return read<T>(res);
}
