import { useState, useEffect } from 'react';

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  thumbnail: string;
}

const RSS_URL = 'https://www.skysports.com/rss/11095';
const FEED_API = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_URL)}`;

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

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(FEED_API);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.status !== 'ok') throw new Error('RSS feed unavailable');
        if (!cancelled) setItems(data.items ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load news');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      <div className="glass" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="f1-heading" style={{ fontSize: 17, color: '#f1f5f9' }}>F1 News</div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>Sky Sports Formula 1</div>
        </div>
        {!loading && !error && (
          <div style={{ fontSize: 11, color: '#334155' }}>{items.length} articles</div>
        )}
      </div>

      {loading && (
        <div style={{ color: '#475569', padding: '60px 0', textAlign: 'center' }}>Loading news…</div>
      )}

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 12, color: '#f87171', fontSize: 13 }}>
          {error}
        </div>
      )}

      {!loading && !error && items.map((item, i) => (
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
              <div style={{ fontSize: 11, color: '#334155', marginTop: 6 }}>{fmtDate(item.pubDate)}</div>
            </div>
          </div>
        </a>
      ))}

    </div>
  );
}
