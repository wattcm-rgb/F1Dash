import { openf1Api } from './openf1Api';

interface LiveDataListener {
  onIntervals: (data: unknown[]) => void;
  onLaps: (data: unknown[]) => void;
  onPitStops: (data: unknown[]) => void;
  onWeather: (data: unknown[]) => void;
  onError: (error: string) => void;
}

class LiveDataSync {
  private sessionKey: number | null = null;
  private pollingInterval: number | null = null;
  private listeners: Set<LiveDataListener> = new Set();
  private readonly POLL_INTERVAL_MS = 4000; // Poll every 4 seconds

  subscribe(listener: LiveDataListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  startSync(sessionKey: number) {
    if (this.sessionKey === sessionKey && this.pollingInterval) {
      return; // Already syncing this session
    }

    this.sessionKey = sessionKey;
    this.poll();
    this.pollingInterval = setInterval(() => this.poll(), this.POLL_INTERVAL_MS);
  }

  stopSync() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.sessionKey = null;
  }

  private async poll() {
    if (!this.sessionKey) return;

    try {
      const [intervals, laps, pitStops, weather] = await Promise.all([
        openf1Api.getIntervals(this.sessionKey),
        openf1Api.getLaps(this.sessionKey),
        openf1Api.getPitStops(this.sessionKey),
        openf1Api.getWeather(this.sessionKey),
      ]);

      this.listeners.forEach((listener) => {
        listener.onIntervals(intervals);
        listener.onLaps(laps);
        listener.onPitStops(pitStops);
        listener.onWeather(weather);
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.listeners.forEach((listener) => {
        listener.onError(`Failed to sync data: ${errorMsg}`);
      });
    }
  }
}

export const liveDataSync = new LiveDataSync();
