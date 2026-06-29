import MetricCard from './ui/MetricCard';

export default function StatCard({ label, value, color, style }) {
  const tone = color === '#FF4D4D' || color === '#ff4d57' ? 'critical' : 'primary';
  return <MetricCard label={label} value={value} tone={tone} style={style} />;
}
