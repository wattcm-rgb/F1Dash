// Cloudflare Worker: authenticating, caching proxy for the OpenF1 paid API.
//
// The browser calls THIS worker (e.g. https://<name>.workers.dev/v1/intervals?...).
// The worker holds the OpenF1 account login as secrets, exchanges it for a 1-hour
// bearer token (cached + refreshed here), and forwards the request to OpenF1 with
// the Authorization header attached. Your password never reaches the browser.
//
// It also caches responses at the edge with a per-endpoint TTL so the live page's
// 4s polling stays well under OpenF1's 6 req/s / 60 req/min limit.
//
// Secrets (set with `wrangler secret put`):
//   OPENF1_USER  -> your OpenF1 account email
//   OPENF1_PASS  -> your OpenF1 account password

const OPENF1 = 'https://api.openf1.org';

// Per-endpoint cache lifetime (seconds). Tuned so total upstream calls stay < 60/min
// even while the live page polls every 4s. Fast-changing data: short; static-ish: long.
const TTL = {
  intervals: 5,
  position: 5,
  location: 6,
  laps: 6,
  race_control: 15,
  pit: 20,
  stints: 30,
  weather: 60,
  drivers: 300,
  sessions: 300,
  car_data: 3600,
};
const DEFAULT_TTL = 8;

function ttlFor(pathname) {
  // pathname like /v1/intervals
  const endpoint = pathname.replace(/^\/v1\//, '').split('?')[0];
  return TTL[endpoint] ?? DEFAULT_TTL;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── token management (cached in the isolate, refreshed before expiry) ──
let tokenCache = { value: null, expiresAt: 0 };
let inflight = null;

async function getToken(env) {
  const now = Date.now();
  if (tokenCache.value && now < tokenCache.expiresAt - 60_000) return tokenCache.value;
  if (inflight) return inflight;

  inflight = (async () => {
    const body = new URLSearchParams({
      grant_type: 'password',
      username: env.OPENF1_USER,
      password: env.OPENF1_PASS,
    });
    const res = await fetch(`${OPENF1}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) throw new Error(`token HTTP ${res.status}`);
    const json = await res.json();
    const ttlMs = (parseInt(json.expires_in, 10) || 3600) * 1000;
    tokenCache = { value: json.access_token, expiresAt: Date.now() + ttlMs };
    inflight = null;
    return tokenCache.value;
  })();

  try {
    return await inflight;
  } catch (e) {
    inflight = null;
    throw e;
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/v1/')) {
      return new Response('Not found', { status: 404, headers: CORS });
    }

    // Serve from edge cache when fresh.
    const cache = caches.default;
    const cached = await cache.match(request);
    if (cached) {
      const out = new Response(cached.body, cached);
      for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
      out.headers.set('X-Proxy-Cache', 'HIT');
      return out;
    }

    let token;
    try {
      token = await getToken(env);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'auth failed', detail: String(e) }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const upstream = `${OPENF1}${url.pathname}${url.search}`;
    const res = await fetch(upstream, { headers: { Authorization: `Bearer ${token}` } });

    const ttl = ttlFor(url.pathname);
    const out = new Response(res.body, res);
    out.headers.set('Cache-Control', `public, max-age=${ttl}`);
    out.headers.set('X-Proxy-Cache', 'MISS');
    for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);

    if (res.ok) ctx.waitUntil(cache.put(request, out.clone()));
    return out;
  },
};
