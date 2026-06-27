export default function WeatherChip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: '#475569' }}>{label}</div>
      <div style={{ fontWeight: 600, color: accent ? '#60a5fa' : '#cbd5e1' }}>{value}</div>
    </div>
  );
}
