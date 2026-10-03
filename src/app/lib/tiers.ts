import { PLANS, type PaidPlan } from "./plans";

/** Readers: anonymous visitors, signed-in members (free) and the three paid plans, from lowest to highest. Safe to import anywhere. */
export type Tier = "anonymous" | "member" | PaidPlan;
export const TIER_RANK: Record<Tier, number> = { anonymous: 0, member: 1, platinum: 2, diamond: 3, supreme: 4 };
export const TIER_LABEL: Record<Tier, string> = { anonymous: "Open", member: "Members", platinum: PLANS.platinum.name, diamond: PLANS.diamond.name, supreme: PLANS.supreme.name };
export const canRead = (reader: Tier, required: Tier) => TIER_RANK[reader] >= TIER_RANK[required];
