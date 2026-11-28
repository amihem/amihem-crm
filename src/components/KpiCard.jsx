export default function KpiCard({ label, value, tone = "ink", sub, icon: Icon, compact = false }) {
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
    <div className={`bg-panel border border-line rounded-2xl ${compact ? "p-3 sm:p-4" : "p-4 sm:p-5"} flex flex-col gap-1 shadow-sm relative overflow-hidden min-w-0`}>
      <div className="flex items-start justify-between gap-1">
        <span className={`${compact ? "text-[10px] sm:text-xs leading-tight" : "text-xs"} font-medium text-muted uppercase tracking-wide min-w-0`}>{label}</span>
        {Icon && (
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
            <Icon size={14} strokeWidth={2.25} />
          </div>
        )}
      </div>
      <span className={`${compact ? "text-[15px] sm:text-2xl whitespace-nowrap" : "text-2xl sm:text-3xl"} font-display font-bold leading-tight ${toneClass}`}>{value}</span>
      {sub && <span className={`${compact ? "text-[10px] sm:text-xs" : "text-xs"} text-muted`}>{sub}</span>}
    </div>
  );
}
