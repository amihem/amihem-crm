// scoring.js — RULE-BASED scoring only, not machine learning. Kept
// transparent and editable so the business logic is obvious and tunable.
import { SCORE_RULES, WON_STAGES, LOST_STAGES, PROBABILITY_RULES } from "../data/schema";
import { daysBetween } from "./helpers";

export function scoreCustomer(customer, tickets, followups) {
  const custTickets = tickets.filter((t) => t.customerId === customer.id);
  const ticketIds = new Set(custTickets.map((t) => t.id));
  const custFollowUps = followups.filter((f) => ticketIds.has(f.ticketId));

  let score = 0;

  const mostRecentActivity = custFollowUps
    .map((f) => f.date)
    .sort((a, b) => new Date(b) - new Date(a))[0];

  if (mostRecentActivity && daysBetween(mostRecentActivity) <= 14) {
    score += SCORE_RULES.visitedRecently;
  }
  if (mostRecentActivity && daysBetween(mostRecentActivity) >= 30) {
    score += SCORE_RULES.inactive30Days;
  }

  score += custTickets.filter((t) => t.stage === "Approved").length * SCORE_RULES.sampleApproved;
  score += custTickets.filter((t) => t.stage === "Trial Order").length * SCORE_RULES.trialOrder;
  score += custTickets.filter((t) => t.stage === "Bulk Order").length * SCORE_RULES.bulkOrder;
  score += custTickets.filter((t) => LOST_STAGES.includes(t.stage)).length * SCORE_RULES.lost;

  return score;
}

export function scoreTemperature(score) {
  if (score >= 50) return "Hot";
  if (score >= 15) return "Warm";
  return "Cold";
}

// Rule-based order-probability estimate for a single ticket, expressed
// as a % (0-95, we never claim certainty). NOT machine learning — just
// transparent point-scoring so a rep can see why a number is what it is.
export function ticketProbability(ticket, followups) {
  if (!ticket) return 0;
  let score = PROBABILITY_RULES.base;
  score += PROBABILITY_RULES.stage[ticket.stage] || 0;
  if (ticket.garmentDeveloped) score += PROBABILITY_RULES.garmentDeveloped;
  if (ticket.received) score += PROBABILITY_RULES.receivedByCustomer;

  const ticketFollowUps = followups.filter((f) => f.ticketId === ticket.id);
  const recentCount = ticketFollowUps.filter((f) => daysBetween(f.date) <= 14).length;
  score += Math.min(recentCount, 3) * PROBABILITY_RULES.perRecentFollowUp;

  return Math.max(0, Math.min(95, score));
}
