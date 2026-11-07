/**
 * Planned missions shown on the landing page. None of these is playable yet,
 * and no difficulty, rating or completion data exists for them.
 */
export interface Mission {
  id: "001" | "002" | "003";
  title: string;
  hook: string;
  category: string;
  themes: string[];
}

export const missions: Mission[] = [
  {
    id: "001",
    title: "The Missing Parcel",
    hook: "A delivery notification leads to a suspicious website and an unexpected one-time code request.",
    category: "Delivery · Codes",
    themes: ["Link provenance", "Urgency manipulation", "OTP safety"],
  },
  {
    id: "002",
    title: "The Dream Job",
    hook: "A promising recruitment opportunity gradually turns into an advance-fee demand.",
    category: "Recruitment · Fees",
    themes: ["Identity verification", "Recruitment red flags", "Financial pressure"],
  },
  {
    id: "003",
    title: "The Impossible Deal",
    hook: "A seemingly attractive marketplace offer leads to pressure for an unsafe payment method.",
    category: "Marketplace · Payments",
    themes: ["Seller verification", "Off-platform transactions", "Evidence evaluation"],
  },
];
