import { useState, useEffect } from 'react';

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
  filterF1?: boolean;
}

const FEEDS: FeedConfig[] = [
  { name: 'Autosport',     url: 'https://www.autosport.com/rss/f1/news/' },
  { name: 'Motorsport',    url: 'https://www.motorsport.com/rss/f1/news/' },
  { name: 'RaceFans',      url: 'https://www.racefans.net/feed/' },
  { name: 'The Race',      url: 'https://the-race.com/formula-1/feed/' },
  { name: 'Sky Sports F1', url: 'https://www.skysports.com/rss/11095', filterF1: true },
];

const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';

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

function isF1Article(link: string, title: string): boolean {
  return link.includes('/f1/') || link.includes('formula-1') ||
    /\bf1\b|formula[\s-]?1|formula[\s-]?one|grand[\s-]?prix/i.test(title);
}

async function fetchFeed(feed: FeedConfig): Promise<NewsItem[]> {
  const res = await fetch(`${RSS2JSON}${encodeURIComponent(feed.url)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error('feed error');
  const items: NewsItem[] = (data.items ?? []).map((item: { title: string; link: string; pubDate: string; description: string; thumbnail: string }) => ({
    title: item.title,
    link: item.link,
    pubDate: item.pubDate,
    description: item.description,
    thumbnail: item.thumbnail,
    source: feed.name,
  }));
  return feed.filterF1 ? items.filter(i => isF1Article(i.link, i.title)) : items;
}

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedFeeds, setFailedFeeds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const results = await Promise.allSettled(FEEDS.map(fetchFeed));
      if (cancelled) return;

      const allItems: NewsItem[] = [];
      const failed: string[] = [];
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          allItems.push(...result.value);
        } else {
          failed.push(FEEDS[i].name);
        }
      });

      allItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
      setItems(allItems);
      setFailedFeeds(failed);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const activeFeeds = FEEDS.filter(f => !failedFeeds.includes(f.name));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      <div className="glass" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="f1-heading" style={{ fontSize: 17, color: '#f1f5f9' }}>F1 News</div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
            {loading ? 'Loading…' : `${activeFeeds.map(f => f.name).join(' · ')}`}
          </div>
        </div>
        {!loading && (
          <div style={{ fontSize: 11, color: '#334155' }}>{items.length} articles</div>
        )}
      </div>

      {failedFeeds.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: '#f87171' }}>
          Could not load: {failedFeeds.join(', ')}
        </div>
      )}

      {loading && (
        <div style={{ color: '#475569', padding: '60px 0', textAlign: 'center' }}>Loading news…</div>
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
