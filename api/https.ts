// api/https.ts
export async function fetchJson(url: string, opts: RequestInit = {}, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort("TIMEOUT"), timeoutMs);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      cache: "no-store",
      headers: { Accept: "application/json", ...(opts.headers || {}) },
    });
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch {}
    return { res, json, text };
  } finally {
    clearTimeout(timer);
  }
}