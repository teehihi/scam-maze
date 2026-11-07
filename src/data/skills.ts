/** The five skill areas shown on the landing page. No scores or levels exist yet. */
export interface Skill {
  id: string;
  name: string;
  question: string;
  practised: string;
  /** Position on the constellation, in percent. */
  x: number;
  y: number;
}

export const skills: Skill[] = [
  {
    id: "source",
    name: "Source Verification",
    question: "Where did this really come from?",
    practised: "Tracing a link, sender or attachment back to its origin before trusting it.",
    x: 50,
    y: 11,
  },
  {
    id: "identity",
    name: "Identity Verification",
    question: "Who is on the other side?",
    practised: "Checking whether a person or account is who it claims to be, using more than what it says about itself.",
    x: 87,
    y: 38,
  },
  {
    id: "pressure",
    name: "Pressure Resistance",
    question: "Why does this have to happen now?",
    practised: "Noticing urgency, secrecy and fear, and slowing down when they appear.",
    x: 73,
    y: 82,
  },
  {
    id: "evidence",
    name: "Evidence Evaluation",
    question: "What does the evidence actually show?",
    practised: "Weighing clues together instead of reacting to a single detail.",
    x: 27,
    y: 82,
  },
  {
    id: "independent",
    name: "Independent Verification",
    question: "Can I confirm this another way?",
    practised: "Stepping outside the conversation and using a channel you chose yourself.",
    x: 13,
    y: 38,
  },
];
