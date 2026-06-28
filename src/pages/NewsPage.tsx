import { useState, useEffect, useCallback } from 'react';

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  thumbnail: string;
  source: string;
}

interface FeedConfig {
  name: string;
  url: string;
}

// Sky Sports feed 11095 is already F1-only, so no client-side filtering is
// applied — every item it returns is shown.
const FEEDS: FeedConfig[] = [
  { name: 'Autosport',     url: 'https://www.autosport.com/rss/f1/news/' },
  { name: 'Motorsport',    url: 'https://www.motorsport.com/rss/f1/news/' },
  { name: 'RaceFans',      url: 'https://www.racefans.net/feed/' },
  { name: 'The Race',      url: 'https://the-race.com/formula-1/feed/' },
  { name: 'Sky Sports F1', url: 'https://www.skysports.com/rss/11095' },
];

const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';
const ALLORIGINS = 'https://api.allorigins.win/raw?url=';

function fmtDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

// Primary path: rss2json (clean JSON, includes thumbnails).
async function fetchViaRss2Json(feed: FeedConfig): Promise<NewsItem[]> {
  const res = await fetch(`${RSS2JSON}${encodeURIComponent(feed.url)}`);
  if (!res.ok) throw new Error(`rss2json HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error(`rss2json status ${data.status}`);
  return (data.items ?? []).map((item: { title: string; link: string; pubDate: string; description: string; thumbnail: string }) => ({
    title: item.title,
    link: item.link,
    pubDate: item.pubDate,
    description: item.description,
    thumbnail: item.thumbnail,
    source: feed.name,
  }));
}

// Fallback path: fetch the raw RSS XML through a CORS proxy and parse it in the
// browser. Covers feeds that rss2json occasionally fails to fetch (e.g. Sky).
async function fetchViaAllOrigins(feed: FeedConfig): Promise<NewsItem[]> {
  const res = await fetch(`${ALLORIGINS}${encodeURIComponent(feed.url)}`);
  if (!res.ok) throw new Error(`allorigins HTTP ${res.status}`);
  const xml = await res.text();
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.querySelector('parsererror')) throw new Error('xml parse error');
  return Array.from(doc.querySelectorAll('item')).map(el => {
    const get = (tag: string) => el.querySelector(tag)?.textContent ?? '';
    let thumbnail = '';
    const media = el.getElementsByTagName('media:content')[0] || el.getElementsByTagName('media:thumbnail')[0];
    if (media) thumbnail = media.getAttribute('url') ?? '';
    if (!thumbnail) {
      const enc = el.querySelector('enclosure');
      if (enc) thumbnail = enc.getAttribute('url') ?? '';
    }
    return {
      title: get('title'),
      link: get('link'),
      pubDate: get('pubDate'),
      description: get('description'),
      thumbnail,
      source: feed.name,
    };
  });
}

async function fetchFeed(feed: FeedConfig): Promise<NewsItem[]> {
  try {
    const items = await fetchViaRss2Json(feed);
    if (items.length) return items;
    // empty result — try the fallback before giving up
    return await fetchViaAllOrigins(feed);
  } catch {
    return await fetchViaAllOrigins(feed);
  }
}

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failedFeeds, setFailedFeeds] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const results = await Promise.allSettled(FEEDS.map(fetchFeed));

    const allItems: NewsItem[] = [];
    const failed: string[] = [];
    results.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value.length) {
        allItems.push(...result.value);
      } else {
        failed.push(FEEDS[i].name);
      }
    });

    allItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
    setItems(allItems);
    setFailedFeeds(failed);
    setLastUpdated(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => { if (!cancelled) await load(false); })();
    return () => { cancelled = true; };
  }, [load]);

  const activeFeeds = FEEDS.filter(f => !failedFeeds.includes(f.name));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      <div className="glass" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="f1-heading" style={{ fontSize: 17, color: '#f1f5f9' }}>F1 News</div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
            {loading ? 'Loading…' : activeFeeds.map(f => f.name).join(' · ')}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!loading && (
            <div style={{ fontSize: 11, color: '#334155', textAlign: 'right' }}>
              <div>{items.length} articles</div>
              {lastUpdated && <div>Updated {lastUpdated.toLocaleTimeString()}</div>}
            </div>
          )}
          <button
            onClick={() => load(true)}
            disabled={loading || refreshing}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)',
              color: '#c084fc', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
              padding: '7px 12px', borderRadius: 7,
              cursor: (loading || refreshing) ? 'default' : 'pointer',
              opacity: (loading || refreshing) ? 0.5 : 1,
            }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}>
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
            {refreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {failedFeeds.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: '#f87171' }}>
          Could not load: {failedFeeds.join(', ')} — try Refresh.
        </div>
      )}

      {loading && (
        <div style={{ color: '#475569', padding: '60px 0', textAlign: 'center' }}>Loading news…</div>
      )}

      {!loading && items.length === 0 && (
        <div style={{ color: '#475569', padding: '60px 0', textAlign: 'center' }}>
          No articles right now. Try Refresh.
        </div>
      )}

      {!loading && items.map((item, i) => (
        <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
          <div className="glass" style={{ padding: 16, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            {item.thumbnail && (
              <img
                src={item.thumbnail}
                alt=""
                style={{ width: 90, height: 64, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', lineHeight: 1.4, marginBottom: 6 }}>
                {item.title}
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, maxHeight: '3em', overflow: 'hidden' }}>
                {stripHtml(item.description)}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', letterSpacing: '0.06em' }}>{item.source.toUpperCase()}</span>
                <span style={{ fontSize: 11, color: '#334155' }}>{fmtDate(item.pubDate)}</span>
              </div>
            </div>
          </div>
        </a>
      ))}

    </div>
  );
}
