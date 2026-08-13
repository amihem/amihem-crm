export default function KpiCard({ label, value, tone = "ink", sub, icon: Icon }) {
  const toneClass = {
    ink: "text-ink",
    thread: "text-thread",
    loom: "text-loom",
    rust: "text-rust",
  }[tone];

  const iconBg = {
    ink: "bg-ink/10 text-ink",
    thread: "bg-thread/10 text-thread",
    loom: "bg-loom/10 text-loom",
    rust: "bg-rust/10 text-rust",
  }[tone];

  return (
    <div className="bg-panel border border-line rounded-2xl p-4 sm:p-5 flex flex-col gap-1 shadow-sm relative overflow-hidden">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted uppercase tracking-wide">{label}</span>
        {Icon && (
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
            <Icon size={14} strokeWidth={2.25} />
          </div>
        )}
      </div>
      <span className={`text-2xl sm:text-3xl font-display font-bold ${toneClass}`}>{value}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}
