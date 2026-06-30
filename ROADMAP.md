# F1Dash — Development Roadmap

Last updated: 2026-06-30

This document captures everything identified during the test-suite build as bugs, performance issues, and missing features. Work through it top to bottom — each phase unblocks the next.

---

## Current state summary

| Page / feature | Data source | Status |
|---|---|---|
| Live race | OpenF1 | Working |
| Historical race | OpenF1 | Working |
| Historical qualifying (2023+) | OpenF1 | ✅ Done — sector times, Q1/Q2/Q3 detection, live mode, elimination zones |
| Historical qualifying (pre-2023) | Jolpica | Working — final Q1/Q2/Q3 times only, no sector times |
| Sprint race | — | **Missing** |
| Sprint qualifying | — | **Missing** |
| Sector time leaderboard | — | Missing |
| Speed trap board | — | Missing |
| Tyre degradation rates | — | Missing |
| Race position fan chart | — | Missing |

---

## Learnings from Phase 0 + Phase 1 implementation (2026-06-30)

These are concrete issues discovered during implementation that affect the remaining phases.

### L.1 Phase 0.2 is still outstanding — `openf1Api.req()` still swallows errors

**Status: NOT DONE.** Phase 0.1 (jolpicaApi) was completed and tested. Phase 0.2 (openf1Api `req()`) was not changed — `req()` still catches all errors and returns `[]`/`null`. During a live race, a rate-limit 429 or a Worker outage is completely invisible to the page and renders as blank data.

This must be addressed before Phase 4.2 (429 backoff) is possible — backoff requires knowing that a 429 occurred.

Recommended approach: add an optional `strict` flag to `req()`. Non-strict (default, used for data fetches) continues returning the fallback. Strict (used for session detection) re-throws. Alternatively, surface errors as a state field in the page and show a banner.

---

### L.2 `QualifyingLeaderboard` empty-segment UX gap

**File:** `src/components/qualifying/QualifyingLeaderboard.tsx`

The component shows the "No data for this segment yet." message only when `drivers.length === 0`. If drivers are loaded but a segment (e.g. Q2) has not started yet, the leaderboard renders all drivers with `—` in every column. This is confusing — it looks broken.

**Fix:** add a second early-return when `segmentLaps.length === 0 && drivers.length > 0`:

```tsx
if (!segmentLaps.length) {
  return (
    <div className="glass" style={{ padding: '48px 0', textAlign: 'center', color: '#334155', fontSize: 13 }}>
      This segment has not started yet.
    </div>
  );
}
```

This also needs a test — the existing test `shows "No data for this segment yet." when drivers list is empty` does NOT cover this case.

---

### L.3 `getQualifyingSessions` may return Sprint Qualifying sessions

**File:** `src/services/openf1Api.ts`

`getQualifyingSessions(year)` queries `/sessions?year=${year}&session_type=Qualifying`. According to the session type reference table, Sprint Qualifying (`Sprint Shootout`) also has `session_type=Qualifying`. Without a `session_name` filter, sprint shootout sessions may appear in the standard qualifying dropdown.

The current `QualifyingPage.tsx` does filter client-side with `s.session_name === 'Qualifying'`, which correctly excludes Sprint Shootout. This is working correctly but it's a subtle dependency: if anyone calls `getQualifyingSessions` without that client-side filter they will get unexpected results.

**Fix for Phase 2:** when implementing `SprintQualifyingPage`, do not reuse `getQualifyingSessions`. Add a separate method:
```ts
getSprintQualifyingSessions: (year: number) =>
  req<OpenF1Session[]>(`/sessions?year=${year}&session_name=Sprint Shootout`, []),
```

---

### L.4 `detectSegments` will mis-split if there are more than two inter-segment breaks

**File:** `src/components/qualifying/derive.ts`

`detectSegments` uses the first two breaks > 5 minutes as Q1→Q2 and Q2→Q3 boundaries. If there is an unexpected gap within a segment (e.g. red flag stoppage, long delay after a crash), a third break point is ignored and laps are correctly split — BUT if the unexpected gap comes first, the Q1/Q2/Q3 split is wrong.

**Mitigation:** For most sessions this is fine. A red flag that stops the session for > 5 min is rare in qualifying, and when it does happen the current code will misclassify some Q1 laps as Q2. 

**Better approach for Phase 2 (when implementing Sprint Qualifying):** instead of taking the first two breaks, take the two *largest* gaps — those will almost always be the true segment boundaries regardless of in-session delays:

```ts
const breaks = [...allGaps].sort((a, b) => b.gap - a.gap).slice(0, 2).sort((a, b) => a.index - b.index);
```

Apply the same fix to the `detectSegments` in `qualifying/derive.ts` before implementing Sprint Qualifying (SQ1/SQ2/SQ3 have shorter segments, so in-segment red flags are proportionally more disruptive).

---

### L.5 Testing pattern — jsdom inline style attribute selectors

Discovered during QualifyingLeaderboard tests: `querySelectorAll('tr[style*="rgba(239,68,68"]')` fails in jsdom because jsdom normalises colours in `style` attributes by adding spaces inside `rgba()` — e.g. `rgba(239, 68, 68, 0.5)`. CSS attribute selectors match the raw string exactly.

**Pattern to use in all future tests:**
```ts
// ❌ Fragile — jsdom normalises rgb/rgba spacing
container.querySelectorAll('[style*="rgba(239,68,68"]')

// ✅ Reliable — check the DOM property directly
const rows = Array.from(container.querySelectorAll('tbody tr')) as HTMLElement[];
rows.filter(row => row.style.borderLeft && !row.style.borderLeft.includes('transparent'))
```

Apply this pattern to any test checking border, background, or colour via inline styles.

---

### L.6 `pages/QualifyingPage.test.tsx` was deferred — still needed

Phase 4.4 listed `src/__tests__/pages/QualifyingPage.test.tsx` as a required test file. It was not written during Phase 1 because the page has significant complexity (two modes: OpenF1 / Jolpica, live detection, segment polling). 

**Scope for the page-level test:**
- Mock `openf1Api.getLatestSession`, `getQualifyingSessions`, `getLaps`, `getDriversBySession`
- Mock `jolpicaApi.getRaces`, `getQualifyingResults`
- Test: year selector switching between OpenF1 mode (2023+) and Jolpica mode (pre-2023)
- Test: live session auto-selection when `isLiveSession()` returns true
- Test: LIVE badge appears when session is live
- Test: CHECKING badge shown during initial detection
- Test: segment tabs (Q1/Q2/Q3) appear only after laps load
- Test: Jolpica fallback renders the old table (no sector cells)

This is the largest missing test gap after Phase 1.

---

---

## Phase 0 — Bug fixes (do these first, they're all small)

### 0.1 `jolpicaApi.ts` — add error handling

**File:** `src/services/jolpicaApi.ts`

Currently has no `try/catch` and no `res.ok` guard. An HTTP 404 with a JSON body is returned as data; a network failure throws an unhandled rejection.

```ts
// Wrap every method body like this:
const res = await fetch(url);
if (!res.ok) throw new Error(`Jolpica ${res.status}: ${url}`);
return res.json();
```

All callers (`QualifyingPage`, `StandingsPage`, `CalendarPage`) need to be checked for error state handling after this change.

---

### 0.2 `openf1Api.ts` — surface errors instead of swallowing them

**File:** `src/services/openf1Api.ts`

The central `req()` helper catches every error and returns `null`/`[]`. Callers cannot distinguish "no data yet" from "API is down". During a live race this makes debugging impossible.

**Change:** Return a typed result `{ data: T | null; error: string | null }` from `req()`, or at minimum re-throw so the page-level error boundary catches it. Decide on one approach and apply it consistently.

---

### 0.3 `openf1Api.getLatestSession` — use max date, not array tail

**File:** `src/services/openf1Api.ts`, `getLatestSession` method

Currently returns `sessions[sessions.length - 1]`. If OpenF1 ever returns sessions out of chronological order this silently returns the wrong session.

```ts
// Replace tail access with:
return sessions.reduce((best, s) =>
  new Date(s.date_start) > new Date(best.date_start) ? s : best
);
```

---

### 0.4 `LivePage` — OFFLINE badge shown during detection

**File:** `src/pages/LivePage.tsx`

The LIVE/OFFLINE badge renders unconditionally based on `isLive` state, which defaults to `false`. Users see "OFFLINE" briefly on every page load while the session check is in flight.

**Change:** Add a third badge state. While `detecting === true`, render a neutral "CHECKING" or greyed-out badge instead of OFFLINE.

```tsx
{detecting
  ? <span style={...greyBadgeStyle}>DETECTING</span>
  : isLive
    ? <span style={...redBadgeStyle}>LIVE</span>
    : <span style={...greyBadgeStyle}>OFFLINE</span>}
```

---

### 0.5 `BattleTab` — memoize `cumulativeTimes`

**File:** `src/components/race/BattleTab.tsx`

`cumulativeTimes(drivers, laps)` is called on every render. During a live race with 20 drivers × 60 laps this is 1200 iterations triggered every 4 seconds by the polling interval.

```ts
const { cumTimeMap } = useMemo(
  () => cumulativeTimes(drivers, laps),
  [drivers, laps]
);
```

Apply the same pattern to `latestPositionMap` in `BattleTab` and `PitStopsTab`.

---

## Phase 1 — Qualifying overhaul

The existing `QualifyingPage.tsx` uses **Jolpica/Ergast**, which does not provide sector times. To add sector time colouring and live mode, qualifying must be rebuilt on top of **OpenF1**, following the same pattern as `LivePage` and `RacePage`.

Jolpica-based historical results can be kept as a fallback for years before OpenF1's coverage starts (pre-2023), but for 2023 onwards OpenF1 is the primary source.

### 1.1 OpenF1 API — add qualifying-specific methods

**File:** `src/services/openf1Api.ts`

Add (or verify existence of) these methods:

```ts
// Sessions of type Qualifying for a given year
getQualifyingSessions(year: number): Promise<OpenF1Session[]>

// Same as getLaps — works for any session type
// Already exists, no change needed — just use getLaps(sessionKey)
```

Qualifying sessions come back from `/sessions?session_type=Qualifying&year=2024` and `/sessions?session_type=Sprint Qualifying&year=2024` (Sprint Shootout).

---

### 1.2 Qualifying data model

**File:** `src/components/qualifying/types.ts` (new)

```ts
export interface QualLap {
  driver_number: number;
  lap_number:    number;
  lap_duration:  number | null;
  sector_1:      number | null;
  sector_2:      number | null;
  sector_3:      number | null;
  is_pit_out_lap: boolean;
  date_start:    string;
}

export type SectorColour = 'purple' | 'green' | 'yellow' | 'grey';

export interface DriverQualBest {
  driver_number: number;
  best_lap:   number | null;
  best_s1:    number | null;
  best_s2:    number | null;
  best_s3:    number | null;
  last_lap:   number | null;
  last_s1:    number | null;
  last_s2:    number | null;
  last_s3:    number | null;
  laps_done:  number;
  on_outlap:  boolean;
}
```

---

### 1.3 Sector colouring logic

**File:** `src/components/qualifying/derive.ts` (new)

```ts
// Returns which colour bucket a sector time falls into.
// purple = fastest of any driver all session
// green  = driver's personal best
// yellow = slower than personal best
// grey   = no time set
export function sectorColour(
  time:        number | null,
  personalBest: number | null,
  overallBest:  number | null,
): SectorColour

// Builds DriverQualBest from raw lap data for one driver.
export function buildQualBest(dn: number, laps: QualLap[]): DriverQualBest

// Overall best sector times across all drivers.
export function overallBests(laps: QualLap[]): { s1: number|null; s2: number|null; s3: number|null }

// Returns the theoretical best lap = best S1 + best S2 + best S3 across the whole field.
export function theoreticalBestLap(laps: QualLap[]): number | null
```

Colour hex values to use (matching existing F1 convention):

| Colour | Hex |
|---|---|
| Purple | `#a855f7` |
| Green | `#4ade80` |
| Yellow | `#facc15` |
| Grey (no time) | `#334155` |

---

### 1.4 SectorCell component

**File:** `src/components/qualifying/SectorCell.tsx` (new)

A single table cell that renders a sector time with the appropriate colour background pill.

```tsx
<SectorCell time={83.241} colour="purple" />
// → renders "1:23.241" in purple, bold, pill background
```

Reuse `fmtTime` from `src/utils/timing.ts` for the time formatting.

---

### 1.5 QualifyingLeaderboard component

**File:** `src/components/qualifying/QualifyingLeaderboard.tsx` (new)

Replaces the simple table in the current page. Columns:

| Pos | Driver | S1 | S2 | S3 | Best Lap | Gap to P1 | Laps |
|---|---|---|---|---|---|---|---|

- Sector cells use `SectorCell` with `sectorColour()` applied to each value
- Sorted by `best_lap` ascending (nulls last)
- Elimination zone: bottom 5 rows highlighted with a red left border (Q1 with 20 drivers, Q2 with 15 drivers — the segment determines the threshold)
- "On outlap" indicator: greyed out row or small badge when driver is on a prep lap (no timed sector yet)

---

### 1.6 Live qualifying mode

**File:** `src/pages/QualifyingPage.tsx` (rewrite)

Follow the same pattern as `LivePage`:

1. On mount, detect the current session with `openf1Api.getLatestSession('Qualifying')` or `getLatestSession('Sprint Qualifying')`
2. If a live qualifying session is found, poll every 4 s using `getLaps(sessionKey)` + `getDriversBySession` + `getWeather`
3. If no live session, switch to historical mode (year + round selector)

**Live mode UI:**
- Session header with LIVE badge and Q1/Q2/Q3 segment indicator
- `QualifyingLeaderboard` showing current bests with sector colours
- Weather chips (track temp matters for tyre choice in qualifying)
- Race control messages (yellow flags invalidate laps)
- Theoretical best lap shown in the header

**Determining which segment (Q1/Q2/Q3) is active:**
OpenF1 does not explicitly mark segment boundaries. Derive from lap count / gap pattern:
- Q1 ends → there is a pause of > 5 min with no new laps → segment changes
- OR use the session's actual start/end times if OpenF1 ever adds this
- Fallback: let the user manually select Q1/Q2/Q3 tab (same as current behaviour)

---

### 1.7 Historical qualifying mode

Keep year + round selectors as they are. Replace the Jolpica data fetch with OpenF1 for years ≥ 2023:

```ts
// Historical mode: load all laps for the selected qualifying session key
const sessions = await openf1Api.getSessionsByYear(year);
const qualSessions = sessions.filter(s => s.session_name === 'Qualifying');
// Then: getLaps(selectedSession.session_key)
```

For years < 2023 where OpenF1 doesn't have data, keep the Jolpica fallback (no sector times, just Q1/Q2/Q3 final times — current behaviour).

---

## Phase 2 — Sprint support

Sprint weekends have two new session types:
- **Sprint Qualifying** (also called Sprint Shootout): SQ1/SQ2/SQ3 format. Like standard qualifying but shorter sessions with 10 cars in SQ3 competing for sprint grid positions.
- **Sprint Race**: ~100 km race, no mandatory pit stops, minimal strategy.

Both sessions already exist in OpenF1 under different `session_name` / `session_type` values.

### 2.1 SprintPage (race)

**File:** `src/pages/SprintPage.tsx` (new)

Essentially identical to `LivePage` + `RacePage` combined, but targeting `session_type === 'Sprint'`. Reuse all existing race components (`Leaderboard`, `BattleTab`, `PitStopsTab`, `RaceControlTab`, `TelemetryTab`, `TrackMapTab`) — they are data-agnostic and will work unchanged.

Implementation steps:
1. Copy `LivePage.tsx` → `SprintPage.tsx`
2. Change `getLatestSession('Race')` → `getLatestSession('Sprint')`
3. Copy `RacePage.tsx` → add Sprint historical support by filtering `session_name === 'Sprint'` in `getSessionsByYear`
4. Add route `/sprint` in `App.tsx`
5. Add nav item to `Layout.tsx`

---

### 2.2 Sprint Qualifying page

**File:** `src/pages/SprintQualifyingPage.tsx` (new)

Identical to the new `QualifyingPage` (Phase 1) but targeting `session_type === 'Sprint Qualifying'` (or `'Sprint Shootout'` — confirm exact string from OpenF1 for the current season).

- SQ1: 12 minutes, 20 → 15 drivers
- SQ2: 10 minutes, 15 → 10 drivers
- SQ3: 8 minutes, top 10

The sector colouring, leaderboard, and live polling are identical to standard qualifying. The elimination thresholds differ (bottom 5 cut each segment, same as standard qualifying).

Implementation: extract the core live polling and display logic from `QualifyingPage` into a shared hook `useQualifyingSession` that accepts the `session_type` as a parameter, so both pages share one implementation.

---

### 2.3 Navigation and routing

**File:** `src/App.tsx`, `src/components/Layout.tsx`

Add two new routes:

```tsx
<Route path="/sprint"              element={<SprintPage />} />
<Route path="/sprint-qualifying"   element={<SprintQualifyingPage />} />
```

Add nav entries — consider grouping Sprint under a collapsible "Sprint Weekend" section in the nav, or adding small sub-labels under the existing Live/Qualifying entries ("Sprint" badge when a sprint weekend is active).

---

## Phase 3 — New data features

These all use data that is already fetched (it's already in the `OpenF1Lap` type) but not displayed anywhere.

### 3.1 Sector time leaderboard tab

**File:** `src/components/race/SectorLeaderboardTab.tsx` (new), added to `RaceTabs.tsx`

Columns: Driver | Fastest S1 | Fastest S2 | Fastest S3 | Theoretical Best Lap | Actual Best Lap | Delta

Colouring: same purple/green/yellow scheme from qualifying — works identically for race data.

The "theoretical best lap" is `min(all S1) + min(all S2) + min(all S3)` across the field. Display it in the header as a banner: "Theoretical best: 1:17.832 (never driven)".

This tab goes between PIT STOPS and BATTLE in `RaceTabs`.

---

### 3.2 Speed trap board

**File:** Add to `SectorLeaderboardTab.tsx` or as a separate tab

Three columns using `i1_speed`, `i2_speed`, `st_speed` from `OpenF1Lap`:

| Driver | Int 1 (km/h) | Int 2 (km/h) | Speed Trap (km/h) |

Sorted by speed trap descending. Shows immediately which cars have the most raw straight-line speed. Useful context for understanding DRS effectiveness and engine mode choices.

---

### 3.3 Tyre degradation rate

**File:** `src/components/race/derive.ts` (add function), used in `Leaderboard.tsx`

```ts
// Linear regression over lap times within a stint, returns seconds/lap degradation rate.
// A positive number means getting slower (expected). Returns null if < 4 laps of data.
export function tyreDegRate(dn: number, stintNum: number, laps: OpenF1Lap[], stints: OpenF1Stint[]): number | null
```

Display in the Leaderboard as a small subscript under the tyre compound: `S 14L +0.08s/L`. Colour-code the rate:
- Green: < 0.05 s/lap (low deg)
- Yellow: 0.05–0.15 s/lap (normal)
- Red: > 0.15 s/lap (high deg — likely to pit soon)

Only show in live mode (historical mode has race already finished so the information is less actionable).

---

### 3.4 Race position fan chart

**File:** `src/components/race/PositionChartTab.tsx` (new), added to `RaceTabs.tsx`

A line chart (SVG, same pattern as the gap chart in BattleTab) showing all drivers' positions over every lap.

- X axis: lap number
- Y axis: position (1 at top, 20 at bottom — inverted)
- Each driver gets a coloured line (`team_colour`)
- Driver acronym labels at the right edge of each line
- Click/hover on a line to highlight that driver

The position data is already fetched by `LivePage`/`RacePage` and passed through `RaceTabs`. No new API calls needed — just a new visualisation component.

This is one of the most-shared F1 visualisations after every race. It shows the full story of the race at a glance (early leaders, crashes that shuffled the order, pit stop sequences, recoveries).

---

## Phase 4 — Infrastructure

> **Important distinction before starting:** there are two separate problems here that are easy to conflate.
> - **Payload size** (how many bytes/rows come back per request) → fixed by delta fetching (4.1).
> - **Request count** (how many calls hit the API per minute) → fixed by polling-budget changes (4.2).
>
> Delta fetching does **not** reduce request count, so it does **not** lower rate-limit exposure. If the goal is "don't get throttled," 4.2 is the section that matters, not 4.1. See "Rate limits & polling budget" below for the full reasoning.

### 4.1 Delta fetching for live polling (reduces payload size)

**File:** `src/pages/LivePage.tsx`

Currently every poll fetches ALL laps, stints, positions, etc. from the beginning of the race. By lap 50 with 20 drivers, the laps response is ~1000 rows fetched 15 times per minute.

OpenF1 supports `date>` filters on most endpoints. Cache the timestamp of the last successful fetch and request only new rows:

```ts
// e.g. GET /laps?session_key=X&date>{lastFetchTimestamp}
openf1Api.getLapsSince(sessionKey, since: string): Promise<OpenF1Lap[]>
```

Merge new rows into existing state rather than replacing it. This dramatically reduces bandwidth and parse time in the second half of a race.

**Note:** this keeps the request *count* identical — it only shrinks each response. It solves bandwidth and parse cost, not rate limits.

---

### 4.2 Reduce request count for live polling (reduces rate-limit exposure)

**File:** `src/pages/LivePage.tsx`, `src/services/openf1Api.ts`

This is the section that actually protects against throttling. See the rate-limit analysis below for the numbers. Four changes, in order of leverage:

1. **Set the OpenF1 token.** `openf1Api.ts` already reads `VITE_OPENF1_TOKEN`. Authenticating raises the OpenF1 rate ceiling and is the single highest-leverage, lowest-effort change. Document the env var in the README and `.env.example`.

2. **Slow the main poll interval.** It is currently `4_000` ms (`pollRef` in `LivePage.tsx`). Live timing data barely changes between 4s and 8s visually. Moving to `8_000`–`10_000` ms roughly halves request rate with no perceptible UX loss.

3. **Stagger endpoints by how fast they change.** `fetchAll` currently fires all 9 requests on the same 4s cadence. Split them:
   - **Fast (positions, intervals, location)** — keep on the short interval.
   - **Slow (weather, stints, pit stops, race control, drivers)** — move to a separate 20–30s interval.
   This alone can cut the request count by ~50% because 5 of the 9 endpoints rarely change.

4. **Back off on HTTP 429.** Tied to Phase 0.2 — `openf1Api` currently swallows errors silently, so a rate-limit response renders as a blank screen with no recovery. Add exponential backoff (e.g. 2s → 4s → 8s → 16s) and pause polling while throttled, then resume. This makes the app degrade gracefully instead of appearing broken.

---

### Rate limits & polling budget (analysis)

**The architecture is the key fact:** F1Dash is a static SPA (GitHub Pages). Every API call is made **directly from the user's browser**, not from a shared backend. Therefore rate limits are enforced **per client IP** — each user spends their own budget, not a pooled one.

**Who is actually at risk:**

| Scenario | Risk |
|---|---|
| Several users in different locations (home / office / cellular) | **Low** — separate IPs, separate budgets, they do not pool. |
| Several users behind the **same network/router** (one office, one house) | **Real** — they share one public IP and therefore one budget. |
| A **single user sitting on the Live page** during a race | Already heavy — see below. |

**The cost is concentrated entirely in the Live page.** Historical Race / Qualifying / Standings / Calendar pages fire one burst of ~7 requests on load and then go quiet — dozens of users browsing history is effectively free.

**Live page request math (from current code):**
- `fetchAll` runs every `4_000` ms and fires **9 requests** (`getLaps`, `getStints`, `getDriversBySession`, `getPitStops`, `getIntervals`, `getRaceControlMessages`, `getWeather`, `getPositions`, `getLocation`).
- `detectSession` runs every `30_000` ms (1 request).

```
9 requests / 4s ≈ 2.25 req/s ≈ ~135 req/min ≈ ~8,100 requests/hour
```

…from **one browser** on the Live page during a race. Three such users behind the same IP ≈ ~24,000 req/hr to OpenF1 — that is the realistic throttling scenario.

**Provider differences:**
- **Jolpica/Ergast** (historical Qualifying, Standings, Calendar) has the **stricter, well-documented** limits (low hundreds of requests/hour anonymous, low burst ceiling). Only fires on load, so normal browsing is safe; rapid round-clicking could trip it.
- **OpenF1** (Live, Race) is looser but its anonymous ceiling is less clearly published and has changed across seasons. The `VITE_OPENF1_TOKEN` path exists specifically to raise it.

> ⚠️ Verify the current published limits on both providers' docs before relying on any specific figure — these get revised between seasons. The numbers above are derived from this codebase's behaviour, not from a guaranteed provider quota.

**Fix priority** (all detailed in 4.2 above): (1) OpenF1 token → (2) slower poll interval → (3) staggered endpoints → (4) 429 backoff.

---

### 4.3 Shared `useQualifyingSession` hook

**File:** `src/hooks/useQualifyingSession.ts` (new)

Extract the live qualifying polling logic so `QualifyingPage` and `SprintQualifyingPage` share one implementation. Accepts `sessionType: 'Qualifying' | 'Sprint Qualifying'` and returns the same state shape as `useLiveSession` but with sector data included.

---

### 4.4 Tests for new features

Write tests alongside each new feature in this order:

| New file | Test file |
|---|---|
| `qualifying/derive.ts` | `src/__tests__/unit/qualifyingDerive.test.ts` |
| `qualifying/SectorCell.tsx` | `src/__tests__/components/SectorCell.test.tsx` |
| `qualifying/QualifyingLeaderboard.tsx` | `src/__tests__/components/QualifyingLeaderboard.test.tsx` |
| `race/SectorLeaderboardTab.tsx` | `src/__tests__/components/SectorLeaderboardTab.test.tsx` |
| `race/PositionChartTab.tsx` | `src/__tests__/components/PositionChartTab.test.tsx` |
| `pages/QualifyingPage.tsx` | `src/__tests__/pages/QualifyingPage.test.tsx` |
| `pages/SprintPage.tsx` | `src/__tests__/pages/SprintPage.test.tsx` |
| `derive.ts` — tyreDegRate | Add to `src/__tests__/unit/derive.test.ts` |

---

## Delivery order

```
Phase 0 (bugs)         → 1–2 hours, all small isolated changes
Phase 1.1–1.5 (qual)   → build the data layer and components first, no page yet
Phase 1.6–1.7 (qual)   → wire up the new QualifyingPage with live + historical modes
Phase 2.1 (sprint)     → SprintPage is ~1 hour (copy + tweak of LivePage/RacePage)
Phase 2.2 (sprint qual) → SprintQualifyingPage using shared hook from Phase 1
Phase 2.3 (nav)        → Add routes and nav items
Phase 3.1–3.2 (sector tabs) → Add SectorLeaderboardTab to RaceTabs
Phase 3.3 (tyre deg)   → Add to Leaderboard in live mode
Phase 3.4 (fan chart)  → Position chart tab
Phase 4 (infra)        → Request-count reduction (4.2) protects live rate limits; delta fetching (4.1) + shared hook cleanup
```

---

## OpenF1 session type reference

These are the `session_name` / `session_type` values to filter on in API calls:

| Session | `session_name` | `session_type` |
|---|---|---|
| Race | `Race` | `Race` |
| Qualifying | `Qualifying` | `Qualifying` |
| Sprint Race | `Sprint` | `Race` |
| Sprint Qualifying | `Sprint Shootout` | `Qualifying` |
| Practice 1 | `Practice 1` | `Practice` |
| Practice 2 | `Practice 2` | `Practice` |
| Practice 3 | `Practice 3` | `Practice` |

Verify the exact strings against the OpenF1 API for the current season before implementing — the Sprint Shootout naming has changed across seasons.

---

## Test suite status (as of this roadmap)

362 tests across 14 files, all passing. All on branch `claude/repo-testing-strategy-08ag4k`.

| File | Tests |
|---|---|
| `unit/timing.test.ts` | 56 |
| `unit/derive.test.ts` | 83 |
| `unit/openf1Types.test.ts` | 14 |
| `services/openf1Api.test.ts` | 35 |
| `services/jolpicaApi.test.ts` | 19 |
| `hooks/useLiveSession.test.ts` | 15 |
| `components/RaceControlTab.test.tsx` | 32 |
| `components/Leaderboard.test.tsx` | 34 |
| `components/TyreChips.test.tsx` | 16 |
| `components/StatusBannerAndWeatherChip.test.tsx` | 12 |
| `components/BattleTab.test.tsx` | 8 |
| `components/PitStopsTab.test.tsx` | 13 |
| `pages/LivePage.test.tsx` | 13 |
| `pages/RacePage.test.tsx` | 12 |
