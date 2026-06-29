import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TyreChips from '../../components/race/TyreChips';
import type { TyreStint } from '../../components/race/derive';

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function makeStint(
  compound: TyreStint['compound'],
  laps: number,
  startLap = 1,
): TyreStint {
  return { compound, laps, startLap, endLap: startLap + laps - 1 };
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe('empty state', () => {
  it('renders an em-dash when history is empty', () => {
    render(<TyreChips history={[]} />);
    expect(screen.getByText('—')).not.toBeNull();
  });

  it('renders no compound labels when history is empty', () => {
    const { container } = render(<TyreChips history={[]} />);
    expect(container.querySelectorAll('span').length).toBe(1); // only the "—" span
  });
});

// ---------------------------------------------------------------------------
// Single stint — compound labels
// ---------------------------------------------------------------------------

describe('compound labels', () => {
  it.each([
    ['SOFT',         'S'],
    ['MEDIUM',       'M'],
    ['HARD',         'H'],
    ['INTERMEDIATE', 'I'],
    ['WET',          'W'],
  ] as [TyreStint['compound'], string][])(
    '%s renders as "%s"',
    (compound, label) => {
      render(<TyreChips history={[makeStint(compound, 10)]} />);
      expect(screen.getByText(label)).not.toBeNull();
    },
  );

  it('renders "?" for UNKNOWN compound', () => {
    render(<TyreChips history={[makeStint('UNKNOWN', 5)]} />);
    expect(screen.getByText('?')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Lap count display
// ---------------------------------------------------------------------------

describe('lap count display', () => {
  it('shows the lap count when showLaps is true (default)', () => {
    render(<TyreChips history={[makeStint('SOFT', 20)]} />);
    expect(screen.getByText('(20L)')).not.toBeNull();
  });

  it('hides the lap count when showLaps is false', () => {
    render(<TyreChips history={[makeStint('SOFT', 20)]} showLaps={false} />);
    expect(screen.queryByText('(20L)')).toBeNull();
  });

  it('hides the lap count when laps is 0', () => {
    render(<TyreChips history={[makeStint('SOFT', 0)]} />);
    expect(screen.queryByText('(0L)')).toBeNull();
    // compound label still renders
    expect(screen.getByText('S')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Multiple stints — separators and ordering
// ---------------------------------------------------------------------------

describe('multiple stints', () => {
  it('renders a "→" separator between two stints', () => {
    render(<TyreChips history={[makeStint('SOFT', 20), makeStint('MEDIUM', 30, 21)]} />);
    expect(screen.getByText('→')).not.toBeNull();
  });

  it('renders no "→" for a single stint', () => {
    render(<TyreChips history={[makeStint('HARD', 50)]} />);
    expect(screen.queryByText('→')).toBeNull();
  });

  it('renders N-1 separators for N stints', () => {
    const history = [
      makeStint('SOFT',   20),
      makeStint('MEDIUM', 20, 21),
      makeStint('HARD',   20, 41),
    ];
    const { container } = render(<TyreChips history={history} />);
    const arrows = container.querySelectorAll('span');
    const arrowSpans = Array.from(arrows).filter(s => s.textContent === '→');
    expect(arrowSpans.length).toBe(2);
  });

  it('renders compound labels in input order', () => {
    const history = [makeStint('SOFT', 20), makeStint('MEDIUM', 30, 21)];
    const { container } = render(<TyreChips history={history} />);
    const text = container.textContent ?? '';
    expect(text.indexOf('S')).toBeLessThan(text.indexOf('M'));
  });

  it('shows individual lap counts for each stint', () => {
    const history = [makeStint('SOFT', 20), makeStint('HARD', 35, 21)];
    render(<TyreChips history={history} />);
    expect(screen.getByText('(20L)')).not.toBeNull();
    expect(screen.getByText('(35L)')).not.toBeNull();
  });
});
