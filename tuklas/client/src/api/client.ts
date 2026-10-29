/**
 * API client — the fetch helpers every API hook uses to talk to the server.
 * Failed requests throw ApiError with the server's message and HTTP status.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** JSON fetch against our own `/api`. The session rides in an httpOnly cookie. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError('Can’t reach Tuklas right now. Check your connection and try again.', 0);
  }
  return read<T>(res);
}

async function read<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? 'Something went wrong. Please try again.', res.status);
  return data as T;
}

/** Sends a file as the raw request body, with its name in a header. The server checks the bytes. */
export async function upload<T = void>(path: string, file: File, method: 'PUT' | 'POST' = 'PUT'): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) },
      body: file,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError('The upload didn’t reach Tuklas. Check your connection and try again.', 0);
  }
  return read<T>(res);
}
