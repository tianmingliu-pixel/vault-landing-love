/* The paid plans, in one place. Prices are in US cents per month; change names, prices or perks here and every page follows. */

export type PaidPlan = "platinum" | "diamond" | "supreme";

export const PLANS: Record<PaidPlan, { name: string; zh: string; cents: number; tagline: string; perks: string[]; color: string; taxCode: string }> = {
  platinum: {
    name: "Platinum",
    zh: "白金",
    cents: 1999,
    tagline: "Every lab in every article.",
    perks: ["Everything members get", "All five hands-on labs: full code, configs and checklists", "New labs as they're published"],
    color: "#e2e8f0",
    taxCode: "txcd_10503005", // digital documents, viewable only, subscription
  },
  diamond: {
    name: "Diamond",
    zh: "钻石",
    cents: 5999,
    tagline: "The labs, plus every kit to take away.",
    perks: ["Everything in Platinum", "Download each article's kit (Markdown, ready for your repo or notes)", "API Breaker, Model Training, Agent Guardrail, Reproducible Data and Live Space kits"],
    color: "#67e8f9",
    taxCode: "txcd_10503002", // digital documents, downloadable, subscription
  },
  supreme: {
    name: "Supreme",
    zh: "至尊",
    cents: 9999,
    tagline: "The whole vault, in one download.",
    perks: ["Everything in Diamond", "One-click bundle of all kits in a single file", "Every future article, lab and kit included"],
    color: "#f0abfc",
    taxCode: "txcd_10503002", // digital documents, downloadable, subscription
  },
};

export const PAID_ORDER: PaidPlan[] = ["platinum", "diamond", "supreme"];
export const isPaidPlan = (value: unknown): value is PaidPlan => typeof value === "string" && value in PLANS;
export const price = (cents: number) => `$${(cents / 100).toFixed(2)}`;
