import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

vi.mock('../../services/openf1Api', () => ({
  openf1Api: {
    getLatestSession:            vi.fn(),
    getQualifyingSessions:       vi.fn(),
    getSprintQualifyingSessions: vi.fn(),
    getLaps:                     vi.fn(),
    getDriversBySession:         vi.fn(),
  },
}));

import LiveQualView from '../../components/qualifying/LiveQualView';
import { openf1Api } from '../../services/openf1Api';

async function flush() { await act(async () => {}); }

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(openf1Api.getQualifyingSessions).mockResolvedValue([]);
  vi.mocked(openf1Api.getSprintQualifyingSessions).mockResolvedValue([]);
  vi.mocked(openf1Api.getLaps).mockResolvedValue([]);
  vi.mocked(openf1Api.getDriversBySession).mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Qualifying variant
// ---------------------------------------------------------------------------

describe('LiveQualView (Qualifying)', () => {
  it('shows "Live Qualifying" heading and a checking banner while detecting', () => {
    vi.mocked(openf1Api.getLatestSession).mockImplementation(() => new Promise(() => {}));
    render(<LiveQualView kind="Qualifying" />);
    expect(screen.getByText('Live Qualifying')).not.toBeNull();
    expect(screen.getByText(/checking for a live session/i)).not.toBeNull();
  });

  it('detects using session_type=Qualifying and session_name=Qualifying', async () => {
    vi.mocked(openf1Api.getLatestSession).mockResolvedValue(null);
    render(<LiveQualView kind="Qualifying" />);
    await flush();
    expect(openf1Api.getLatestSession).toHaveBeenCalledWith('Qualifying', 'Qualifying');
  });

  it('shows the "No live qualifying right now" banner when nothing is live', async () => {
    vi.mocked(openf1Api.getLatestSession).mockResolvedValue(null);
    render(<LiveQualView kind="Qualifying" />);
    await flush();
    expect(screen.getByText(/no live qualifying right now/i)).not.toBeNull();
    expect(screen.getByText('OFFLINE')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Sprint Shootout variant
// ---------------------------------------------------------------------------

describe('LiveQualView (Sprint Shootout)', () => {
  it('shows "Live Sprint Qualifying" heading while detecting', () => {
    vi.mocked(openf1Api.getLatestSession).mockImplementation(() => new Promise(() => {}));
    render(<LiveQualView kind="Sprint Shootout" />);
    expect(screen.getByText('Live Sprint Qualifying')).not.toBeNull();
  });

  it('detects using session_name=Sprint Shootout', async () => {
    vi.mocked(openf1Api.getLatestSession).mockResolvedValue(null);
    render(<LiveQualView kind="Sprint Shootout" />);
    await flush();
    expect(openf1Api.getLatestSession).toHaveBeenCalledWith('Qualifying', 'Sprint Shootout');
  });

  it('shows the "No live sprint qualifying right now" banner when nothing is live', async () => {
    vi.mocked(openf1Api.getLatestSession).mockResolvedValue(null);
    render(<LiveQualView kind="Sprint Shootout" />);
    await flush();
    expect(screen.getByText(/no live sprint qualifying right now/i)).not.toBeNull();
  });

  it('uses the sprint-qualifying sessions endpoint', async () => {
    vi.mocked(openf1Api.getLatestSession).mockResolvedValue(null);
    render(<LiveQualView kind="Sprint Shootout" />);
    await flush();
    expect(openf1Api.getSprintQualifyingSessions).toHaveBeenCalled();
    expect(openf1Api.getQualifyingSessions).not.toHaveBeenCalled();
  });
});
