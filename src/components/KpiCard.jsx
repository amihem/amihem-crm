export default function KpiCard({ label, value, tone = "ink", sub }) {
  const toneClass = {
    ink: "text-ink",
    thread: "text-thread",
    loom: "text-loom",
    rust: "text-rust",
  }[tone];

  return (
    <div className="bg-panel border border-line rounded-2xl p-4 sm:p-5 flex flex-col gap-1 shadow-sm">
      <span className="text-xs font-medium text-muted uppercase tracking-wide">{label}</span>
      <span className={`text-2xl sm:text-3xl font-display font-bold ${toneClass}`}>{value}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}
