import { WON_STAGES, LOST_STAGES } from "../data/schema";

const COLORS = {
  won: "bg-loom/10 text-loom border-loom/30",
  lost: "bg-rust/10 text-rust border-rust/30",
  open: "bg-thread/10 text-thread border-thread/30",
  active: "bg-loom/10 text-loom border-loom/30",
  potential: "bg-thread/10 text-thread border-thread/30",
  inactive: "bg-muted/10 text-muted border-muted/30",
  lostcust: "bg-rust/10 text-rust border-rust/30",
  high: "bg-rust/10 text-rust border-rust/30",
  medium: "bg-thread/10 text-thread border-thread/30",
  low: "bg-muted/10 text-muted border-muted/30",
};

export function StageBadge({ stage }) {
  let tone = "open";
  if (WON_STAGES.includes(stage)) tone = "won";
  else if (LOST_STAGES.includes(stage)) tone = "lost";
  return <Badge tone={tone}>{stage}</Badge>;
}

export function CustomerStatusBadge({ status }) {
  const tone =
    status === "Active" ? "active" :
    status === "Potential" ? "potential" :
    status === "Lost" ? "lostcust" : "inactive";
  return <Badge tone={tone}>{status}</Badge>;
}

export function PriorityBadge({ priority }) {
  const tone = priority?.toLowerCase() || "low";
  return <Badge tone={tone}>{priority}</Badge>;
}

export function Badge({ tone = "open", children }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${COLORS[tone]}`}
    >
      {children}
    </span>
  );
}
