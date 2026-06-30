import { describe, it, expect } from 'vitest';
import { isLiveSession, isPastSession, sessionLabel, isSprintQualifyingName, sessionNameMatcher } from '../../types/openf1';
import type { OpenF1Session } from '../../types/openf1';

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<OpenF1Session> = {}): OpenF1Session {
  return {
    session_key: 1,
    session_name: 'Race',
    session_type: 'Race',
    date_start: '2020-01-01T10:00:00',
    date_end:   '2020-01-01T12:00:00',
    year: 2020,
    meeting_key: 1,
    meeting_name: 'Test Grand Prix',
    circuit_short_name: 'TGP',
    country_name: 'Testland',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// isSprintQualifyingName / sessionNameMatcher
// The sprint-qualifying session was "Sprint Shootout" (2023) then renamed to
// "Sprint Qualifying" (2024+); both must match.
// ---------------------------------------------------------------------------

describe('isSprintQualifyingName', () => {
  it('matches the 2023 "Sprint Shootout" label', () => {
    expect(isSprintQualifyingName('Sprint Shootout')).toBe(true);
  });

  it('matches the 2024+ "Sprint Qualifying" label', () => {
    expect(isSprintQualifyingName('Sprint Qualifying')).toBe(true);
  });

  it('does not match standard "Qualifying"', () => {
    expect(isSprintQualifyingName('Qualifying')).toBe(false);
  });

  it('does not match the sprint race "Sprint"', () => {
    expect(isSprintQualifyingName('Sprint')).toBe(false);
  });
});

describe('sessionNameMatcher', () => {
  it('returns an exact matcher for a non-sprint-qual name', () => {
    const m = sessionNameMatcher('Qualifying');
    expect(m('Qualifying')).toBe(true);
    expect(m('Sprint Qualifying')).toBe(false);
    expect(m('Race')).toBe(false);
  });

  it('returns a both-label matcher when given a sprint-qual name', () => {
    const m = sessionNameMatcher('Sprint Shootout');
    expect(m('Sprint Shootout')).toBe(true);
    expect(m('Sprint Qualifying')).toBe(true);
    expect(m('Qualifying')).toBe(false);
  });

  it('treats "Sprint Qualifying" as a sprint-qual filter too', () => {
    const m = sessionNameMatcher('Sprint Qualifying');
    expect(m('Sprint Shootout')).toBe(true);
    expect(m('Sprint Qualifying')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// sessionLabel
// Prefers meeting_name, then falls back through location → circuit_short_name
// → country_name → 'Unknown'.
// ---------------------------------------------------------------------------

describe('sessionLabel', () => {
  it('returns meeting_name when it is present', () => {
    expect(sessionLabel(makeSession({ meeting_name: 'Bahrain Grand Prix' }))).toBe('Bahrain Grand Prix');
  });

  it('falls back to location when meeting_name is empty', () => {
    expect(sessionLabel(makeSession({ meeting_name: '', location: 'Sakhir' }))).toBe('Sakhir');
  });

  it('falls back to circuit_short_name when meeting_name and location are both empty', () => {
    expect(sessionLabel(makeSession({ meeting_name: '', location: '', circuit_short_name: 'BAH' }))).toBe('BAH');
  });

  it('falls back to country_name when the three higher fields are empty', () => {
    expect(sessionLabel(makeSession({ meeting_name: '', location: '', circuit_short_name: '', country_name: 'Bahrain' }))).toBe('Bahrain');
  });

  it('returns "Unknown" when all label fields are empty', () => {
    expect(sessionLabel(makeSession({ meeting_name: '', location: '', circuit_short_name: '', country_name: '' }))).toBe('Unknown');
  });
});

// ---------------------------------------------------------------------------
// isLiveSession
// Returns true only when now is within [date_start, date_end).
// ---------------------------------------------------------------------------

describe('isLiveSession', () => {
  const PAST   = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 h ago
  const RECENT = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(); // 1 h ago
  const FUTURE = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(); // 1 h from now

  it('returns true when now is between date_start and date_end', () => {
    expect(isLiveSession(makeSession({ date_start: PAST, date_end: FUTURE }))).toBe(true);
  });

  it('returns false when the session has not started yet', () => {
    expect(isLiveSession(makeSession({ date_start: FUTURE, date_end: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() }))).toBe(false);
  });

  it('returns false when the session has already ended', () => {
    expect(isLiveSession(makeSession({ date_start: PAST, date_end: RECENT }))).toBe(false);
  });

  it('returns false when date_start is an empty string', () => {
    expect(isLiveSession(makeSession({ date_start: '', date_end: FUTURE }))).toBe(false);
  });

  it('returns false when date_end is an empty string', () => {
    expect(isLiveSession(makeSession({ date_start: PAST, date_end: '' }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isPastSession
// Returns true when date_start is non-empty and is in the past (≤ now).
// ---------------------------------------------------------------------------

describe('isPastSession', () => {
  const PAST   = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  it('returns true when date_start is in the past', () => {
    expect(isPastSession(makeSession({ date_start: PAST }))).toBe(true);
  });

  it('returns false when date_start is in the future', () => {
    expect(isPastSession(makeSession({ date_start: FUTURE }))).toBe(false);
  });

  it('returns false when date_start is an empty string', () => {
    expect(isPastSession(makeSession({ date_start: '' }))).toBe(false);
  });

  it('is independent of date_end — a past session with a future end is still past', () => {
    expect(isPastSession(makeSession({ date_start: PAST, date_end: FUTURE }))).toBe(true);
  });
});
