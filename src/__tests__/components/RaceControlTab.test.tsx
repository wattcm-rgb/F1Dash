import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RaceControlTab from '../../components/race/RaceControlTab';
import type { RcMsg } from '../../components/race/types';

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function makeMsg(overrides: Partial<RcMsg> = {}): RcMsg {
  return {
    date: '2024-03-02T14:30:00',
    message: 'Test message',
    flag: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Empty state
// Rendered when the filtered list is empty — either no messages at all, or
// every message was stripped out by the relevance filter.
// ---------------------------------------------------------------------------

describe('empty state', () => {
  it('shows the no-messages notice when the prop array is empty', () => {
    render(<RaceControlTab rcMsgs={[]} />);
    expect(screen.getByText(/no notable race control messages/i)).not.toBeNull();
  });

  it('shows the no-messages notice when every message is filtered out', () => {
    render(<RaceControlTab rcMsgs={[makeMsg({ flag: 'BLUE', message: 'Blue flag car 10' })]} />);
    expect(screen.getByText(/no notable race control messages/i)).not.toBeNull();
  });

  it('does not render the RACE CONTROL header in the empty state', () => {
    render(<RaceControlTab rcMsgs={[]} />);
    expect(screen.queryByText('RACE CONTROL')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isRelevant — flag-based inclusion
// YELLOW, DOUBLE YELLOW, RED, BLACK AND WHITE are all surfaced.
// ---------------------------------------------------------------------------

describe('isRelevant — included flags', () => {
  it.each([
    ['YELLOW',          'Yellow flag in sector 3'],
    ['DOUBLE YELLOW',   'Double yellow in sector 1'],
    ['RED',             'Red flag — race stopped'],
    ['BLACK AND WHITE', 'Black and white flag for car 44'],
  ])('shows message with flag=%s', (flag, message) => {
    render(<RaceControlTab rcMsgs={[makeMsg({ flag, message })]} />);
    expect(screen.getByText(message)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isRelevant — flag-based exclusion
// Blue flags are deliberately omitted to reduce noise.
// ---------------------------------------------------------------------------

describe('isRelevant — excluded flags', () => {
  it('hides messages with a BLUE flag', () => {
    render(<RaceControlTab rcMsgs={[makeMsg({ flag: 'BLUE', message: 'Blue flag car 10' })]} />);
    expect(screen.queryByText('Blue flag car 10')).toBeNull();
  });

  it('hides messages with no flag, category, or relevant keyword', () => {
    render(<RaceControlTab rcMsgs={[makeMsg({ message: 'Track is clear' })]} />);
    expect(screen.queryByText('Track is clear')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isRelevant — category-based inclusion
// SAFETYCAR and VIRTUALSAFETYCAR categories are always surfaced regardless
// of flag or message content.
// ---------------------------------------------------------------------------

describe('isRelevant — category', () => {
  it('shows messages with category SAFETYCAR', () => {
    render(<RaceControlTab rcMsgs={[makeMsg({ category: 'SAFETYCAR', message: 'Safety car deployed' })]} />);
    expect(screen.getByText('Safety car deployed')).not.toBeNull();
  });

  it('shows messages with category VIRTUALSAFETYCAR', () => {
    render(<RaceControlTab rcMsgs={[makeMsg({ category: 'VIRTUALSAFETYCAR', message: 'VSC deployed' })]} />);
    expect(screen.getByText('VSC deployed')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isRelevant — message keyword inclusion
// Seven specific phrases trigger inclusion regardless of flag/category.
// ---------------------------------------------------------------------------

describe('isRelevant — message keywords', () => {
  it.each([
    'SAFETY CAR',
    'VIRTUAL SAFETY CAR',
    'INVESTIGATION',
    'PENALTY',
    'DRIVE THROUGH',
    'STOP AND GO',
    'BLACK AND WHITE',
  ])('shows messages containing "%s"', (keyword) => {
    const message = `Incident: ${keyword} issued`;
    render(<RaceControlTab rcMsgs={[makeMsg({ message })]} />);
    expect(screen.getByText(message)).not.toBeNull();
  });

  it('keyword matching is case-insensitive on the message field', () => {
    render(<RaceControlTab rcMsgs={[makeMsg({ message: 'car under investigation' })]} />);
    expect(screen.getByText('car under investigation')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isRelevant — edge cases
// ---------------------------------------------------------------------------

describe('isRelevant — edge cases', () => {
  it('flag matching is case-insensitive', () => {
    render(<RaceControlTab rcMsgs={[makeMsg({ flag: 'yellow', message: 'Lowercase yellow flag' })]} />);
    expect(screen.getByText('Lowercase yellow flag')).not.toBeNull();
  });

  it('does not throw when flag is null and category is undefined', () => {
    expect(() =>
      render(<RaceControlTab rcMsgs={[makeMsg({ flag: null, category: undefined, message: 'Neutral message' })]} />),
    ).not.toThrow();
  });

  it('blue-flag messages are hidden even when mixed with relevant ones in the same batch', () => {
    const msgs = [
      makeMsg({ flag: 'BLUE',   message: 'Blue flag car 10 (hidden)' }),
      makeMsg({ flag: 'YELLOW', message: 'Yellow flag sector 2 (shown)' }),
    ];
    render(<RaceControlTab rcMsgs={msgs} />);
    expect(screen.queryByText('Blue flag car 10 (hidden)')).toBeNull();
    expect(screen.getByText('Yellow flag sector 2 (shown)')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Alert count
// Displayed in the header as "<n> alerts" reflecting only the filtered total.
// ---------------------------------------------------------------------------

describe('alert count', () => {
  it('shows "1 alerts" for a single passing message', () => {
    render(<RaceControlTab rcMsgs={[makeMsg({ flag: 'YELLOW', message: 'Yellow flag' })]} />);
    expect(screen.getByText('1 alerts')).not.toBeNull();
  });

  it('counts only the relevant messages, not the total input length', () => {
    const msgs = [
      makeMsg({ flag: 'YELLOW', message: 'Relevant 1' }),
      makeMsg({ flag: 'RED',    message: 'Relevant 2' }),
      makeMsg({ flag: 'BLUE',   message: 'Filtered out' }),
    ];
    render(<RaceControlTab rcMsgs={msgs} />);
    expect(screen.getByText('2 alerts')).not.toBeNull();
  });

  it('shows the RACE CONTROL header alongside the count', () => {
    render(<RaceControlTab rcMsgs={[makeMsg({ flag: 'RED', message: 'Red flag' })]} />);
    expect(screen.getByText('RACE CONTROL')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Message rendering
// ---------------------------------------------------------------------------

describe('message rendering', () => {
  it('shows the message text in the row', () => {
    render(<RaceControlTab rcMsgs={[makeMsg({ flag: 'YELLOW', message: 'Yellow in sector 3' })]} />);
    expect(screen.getByText('Yellow in sector 3')).not.toBeNull();
  });

  it('renders all passing messages from a mixed batch', () => {
    const msgs = [
      makeMsg({ flag: 'YELLOW', message: 'Yellow sector 1' }),
      makeMsg({ flag: 'YELLOW', message: 'Yellow sector 2' }),
    ];
    render(<RaceControlTab rcMsgs={msgs} />);
    expect(screen.getByText('Yellow sector 1')).not.toBeNull();
    expect(screen.getByText('Yellow sector 2')).not.toBeNull();
  });

  it('renders messages newest-first (reverse chronological order)', () => {
    const msgs = [
      makeMsg({ flag: 'YELLOW', message: 'Lap 1 incident',  date: '2024-03-02T13:00:00' }),
      makeMsg({ flag: 'YELLOW', message: 'Lap 20 incident', date: '2024-03-02T14:00:00' }),
      makeMsg({ flag: 'RED',    message: 'Lap 40 incident', date: '2024-03-02T15:00:00' }),
    ];
    const { container } = render(<RaceControlTab rcMsgs={msgs} />);
    const text = container.textContent ?? '';
    // Lap 40 should appear before Lap 20, which should appear before Lap 1.
    expect(text.indexOf('Lap 40 incident')).toBeLessThan(text.indexOf('Lap 20 incident'));
    expect(text.indexOf('Lap 20 incident')).toBeLessThan(text.indexOf('Lap 1 incident'));
  });

  it('shows the flag badge text when the message has a flag', () => {
    render(<RaceControlTab rcMsgs={[makeMsg({ flag: 'RED', message: 'Red flag issued' })]} />);
    // Badge renders flag.toUpperCase() as its text content.
    expect(screen.getByText('RED')).not.toBeNull();
  });

  it('shows no flag badge when the message has a null flag', () => {
    render(<RaceControlTab rcMsgs={[makeMsg({ category: 'SAFETYCAR', message: 'SC deployed', flag: null })]} />);
    // "SAFETYCAR" should NOT appear as a badge — it's a category, not a flag.
    expect(screen.queryByText('SAFETYCAR')).toBeNull();
    // The message text must still be visible.
    expect(screen.getByText('SC deployed')).not.toBeNull();
  });

  it('uppercases the flag text in the badge', () => {
    render(<RaceControlTab rcMsgs={[makeMsg({ flag: 'yellow', message: 'Lowercase input' })]} />);
    expect(screen.getByText('YELLOW')).not.toBeNull();
  });

  it('renders a timestamp element for each message row', () => {
    const msgs = [
      makeMsg({ flag: 'YELLOW', message: 'First msg' }),
      makeMsg({ flag: 'RED',    message: 'Second msg' }),
    ];
    const { container } = render(<RaceControlTab rcMsgs={msgs} />);
    // Each row has a monospace timestamp span. Check count matches message count.
    const timestampSpans = container.querySelectorAll('span[style*="monospace"]');
    expect(timestampSpans.length).toBe(2);
  });
});
