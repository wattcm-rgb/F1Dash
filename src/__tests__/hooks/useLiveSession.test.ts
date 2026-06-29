import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLiveSession } from '../../hooks/useLiveSession';
import { openf1Api } from '../../services/openf1Api';
import { isLiveSession } from '../../types/openf1';
import type { OpenF1Session } from '../../types/openf1';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../services/openf1Api', () => ({
  openf1Api: { getCurrentSession: vi.fn() },
}));

// Partially mock openf1 types: keep all real exports, replace only isLiveSession.
// This decouples hook tests from the date-comparison logic (tested separately).
vi.mock('../../types/openf1', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../types/openf1')>();
  return { ...actual, isLiveSession: vi.fn() };
});

const mockGetCurrentSession = vi.mocked(openf1Api.getCurrentSession);
const mockIsLiveSession = vi.mocked(isLiveSession);

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<OpenF1Session> = {}): OpenF1Session {
  return {
    session_key: 9999,
    session_name: 'Race',
    session_type: 'Race',
    date_start: '2024-03-02T13:00:00',
    date_end: '2024-03-02T15:00:00',
    year: 2024,
    meeting_key: 1,
    meeting_name: 'Bahrain Grand Prix',
    circuit_short_name: 'Bahrain',
    country_name: 'Bahrain',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // Safe defaults so tests that don't care about values don't break.
  mockGetCurrentSession.mockResolvedValue(null);
  mockIsLiveSession.mockReturnValue(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// Flush all pending microtasks (resolved promises) inside React's act boundary.
// Keeps tests from needing waitFor, which conflicts with fake timers.
async function flush() {
  await act(async () => {});
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('initial state', () => {
  it('is { session: null, isLive: false, loading: true } before the first fetch resolves', () => {
    // Never-resolving promise keeps the hook in its "pending fetch" state.
    mockGetCurrentSession.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useLiveSession());
    expect(result.current).toEqual({ session: null, isLive: false, loading: true });
  });
});

// ---------------------------------------------------------------------------
// State after first fetch
// ---------------------------------------------------------------------------

describe('state after first fetch', () => {
  it('sets loading=false once the API call resolves', async () => {
    const { result } = renderHook(() => useLiveSession());
    await flush();
    expect(result.current.loading).toBe(false);
  });

  it('stores the session object returned by the API', async () => {
    const session = makeSession({ session_key: 42 });
    mockGetCurrentSession.mockResolvedValue(session);
    const { result } = renderHook(() => useLiveSession());
    await flush();
    expect(result.current.session).toEqual(session);
  });

  it('sets isLive=true when isLiveSession returns true', async () => {
    mockGetCurrentSession.mockResolvedValue(makeSession());
    mockIsLiveSession.mockReturnValue(true);
    const { result } = renderHook(() => useLiveSession());
    await flush();
    expect(result.current.isLive).toBe(true);
  });

  it('sets isLive=false when isLiveSession returns false', async () => {
    mockGetCurrentSession.mockResolvedValue(makeSession());
    mockIsLiveSession.mockReturnValue(false);
    const { result } = renderHook(() => useLiveSession());
    await flush();
    expect(result.current.isLive).toBe(false);
  });

  it('passes the returned session into isLiveSession', async () => {
    const session = makeSession({ session_key: 7 });
    mockGetCurrentSession.mockResolvedValue(session);
    renderHook(() => useLiveSession());
    await flush();
    expect(mockIsLiveSession).toHaveBeenCalledWith(session);
  });

  it('sets session=null and isLive=false without calling isLiveSession when API returns null', async () => {
    mockGetCurrentSession.mockResolvedValue(null);
    const { result } = renderHook(() => useLiveSession());
    await flush();
    expect(result.current.session).toBeNull();
    expect(result.current.isLive).toBe(false);
    expect(mockIsLiveSession).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Polling
// ---------------------------------------------------------------------------

describe('polling', () => {
  it('calls getCurrentSession once immediately on mount', async () => {
    renderHook(() => useLiveSession(5_000));
    await flush();
    expect(mockGetCurrentSession).toHaveBeenCalledTimes(1);
  });

  it('calls getCurrentSession again after each interval elapses', async () => {
    renderHook(() => useLiveSession(5_000));
    await flush();

    act(() => { vi.advanceTimersByTime(5_000); });
    await flush();
    expect(mockGetCurrentSession).toHaveBeenCalledTimes(2);

    act(() => { vi.advanceTimersByTime(5_000); });
    await flush();
    expect(mockGetCurrentSession).toHaveBeenCalledTimes(3);
  });

  it('does not poll before the interval has elapsed', async () => {
    renderHook(() => useLiveSession(5_000));
    await flush();

    act(() => { vi.advanceTimersByTime(4_999); });
    await flush();
    expect(mockGetCurrentSession).toHaveBeenCalledTimes(1);
  });

  it('uses 30 seconds as the default poll interval', async () => {
    renderHook(() => useLiveSession());
    await flush();

    act(() => { vi.advanceTimersByTime(29_999); });
    await flush();
    expect(mockGetCurrentSession).toHaveBeenCalledTimes(1); // not yet

    act(() => { vi.advanceTimersByTime(1); }); // total = 30 000 ms
    await flush();
    expect(mockGetCurrentSession).toHaveBeenCalledTimes(2);
  });

  it('reflects the latest session on each poll', async () => {
    const s1 = makeSession({ session_key: 1 });
    const s2 = makeSession({ session_key: 2 });
    mockGetCurrentSession
      .mockResolvedValueOnce(s1)
      .mockResolvedValueOnce(s2);

    const { result } = renderHook(() => useLiveSession(5_000));
    await flush();
    expect(result.current.session?.session_key).toBe(1);

    act(() => { vi.advanceTimersByTime(5_000); });
    await flush();
    expect(result.current.session?.session_key).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Cleanup on unmount
// ---------------------------------------------------------------------------

describe('cleanup on unmount', () => {
  it('stops polling after the component unmounts', async () => {
    const { unmount } = renderHook(() => useLiveSession(5_000));
    await flush();
    expect(mockGetCurrentSession).toHaveBeenCalledTimes(1);

    unmount();

    act(() => { vi.advanceTimersByTime(10_000); }); // two intervals worth
    await flush();
    // Call count must not increase after unmount.
    expect(mockGetCurrentSession).toHaveBeenCalledTimes(1);
  });

  it('does not update state if a pending fetch resolves after unmount', async () => {
    let resolveFirst!: (s: OpenF1Session | null) => void;
    mockGetCurrentSession.mockImplementationOnce(
      () => new Promise<OpenF1Session | null>(r => { resolveFirst = r; }),
    );

    const { unmount } = renderHook(() => useLiveSession());
    // Fetch is in-flight — unmount before it resolves.
    unmount();

    // The cancellation guard (`cancelled = true`) should swallow the result.
    await act(async () => { resolveFirst(makeSession()); });

    // No React warning about updating state on an unmounted component.
    expect(console.error).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// pollMs dependency
// ---------------------------------------------------------------------------

describe('pollMs dependency', () => {
  it('resets the interval when pollMs changes', async () => {
    const { rerender } = renderHook(
      ({ ms }: { ms: number }) => useLiveSession(ms),
      { initialProps: { ms: 5_000 } },
    );
    await flush();
    expect(mockGetCurrentSession).toHaveBeenCalledTimes(1);

    // Changing pollMs triggers effect cleanup + re-run, which calls check() immediately.
    rerender({ ms: 10_000 });
    await flush();
    expect(mockGetCurrentSession).toHaveBeenCalledTimes(2);

    // New 10 s interval fires.
    act(() => { vi.advanceTimersByTime(10_000); });
    await flush();
    expect(mockGetCurrentSession).toHaveBeenCalledTimes(3);

    // Old 5 s interval is gone — advancing 5 s more doesn't fire anything.
    act(() => { vi.advanceTimersByTime(5_000); });
    await flush();
    expect(mockGetCurrentSession).toHaveBeenCalledTimes(3);
  });
});
