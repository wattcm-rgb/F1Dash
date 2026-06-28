# f1dash-openf1 — OpenF1 auth + caching proxy (Cloudflare Worker)

The static dashboard cannot safely hold the OpenF1 account password (it would be
visible in the public JS bundle). This Worker keeps the login server-side, mints and
refreshes the 1-hour bearer token, and caches responses at the edge so the live page's
4-second polling stays under OpenF1's 6 req/s / 60 req/min limit.

```
browser ──> https://f1dash-openf1.<you>.workers.dev/v1/... ──(Bearer)──> api.openf1.org
```

## One-time deploy

From this `worker/` folder:

```bash
npx wrangler login                       # opens browser, log into (free) Cloudflare account
npx wrangler secret put OPENF1_USER      # paste your OpenF1 account email
npx wrangler secret put OPENF1_PASS      # paste your OpenF1 account password
npx wrangler deploy
```

`deploy` prints the URL, e.g. `https://f1dash-openf1.yourname.workers.dev`.
Give that URL to the site build as `VITE_OPENF1_BASE_URL=<url>/v1`.

## Rotating the password

If you change your OpenF1 password, just re-run `npx wrangler secret put OPENF1_PASS`
and `npx wrangler deploy`. Nothing in the site needs to change.

## Notes

- Secrets live in Cloudflare, never in this repo.
- Cache TTLs are tuned in `src/index.js` (`TTL` map). Lower them for fresher data,
  raise them if you approach the rate limit.
- `X-Proxy-Cache: HIT/MISS` response header shows whether a response was served
  from edge cache.
