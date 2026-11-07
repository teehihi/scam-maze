/**
 * Fictional case data for the landing-page "investigation workspace".
 * Relationships are hand-authored for illustration. Nothing here is inferred
 * or detected automatically, and every address uses a reserved name.
 */

export type NodeId = "msg" | "site" | "acct" | "chat" | "req";

export interface Evidence {
  id: NodeId;
  code: string;
  time: string;
  /** Short node label for the trust network. */
  node: string;
  snippet: string;
  signal: string;
  /** Alternative decision available at this moment (consequence replay). */
  alternative: string;
  /** Position in the network, in percent. */
  x: number;
  y: number;
  suspicious: boolean;
}

export const evidence: Evidence[] = [
  {
    id: "msg",
    code: "E-01",
    time: "07:42",
    node: "Message",
    snippet: "A text about a held parcel arrives from a number that is not in the order history.",
    signal: "Unfamiliar sender",
    alternative: "Open the shopping app yourself and look for the order.",
    x: 18,
    y: 17,
    suspicious: false,
  },
  {
    id: "site",
    code: "E-02",
    time: "07:44",
    node: "Website",
    snippet: "The page address is swiftparcel-verify.test. The courier’s own address in this world is swiftparcel.example.",
    signal: "Look-alike address",
    alternative: "Type the courier’s address yourself instead of following the link.",
    x: 54,
    y: 13,
    suspicious: true,
  },
  {
    id: "acct",
    code: "E-03",
    time: "07:51",
    node: "Account · Dana",
    snippet: "A “support agent” joins. The account was created 2 days ago and shares no contacts with you.",
    signal: "New, unconnected account",
    alternative: "Contact support through the number printed on your receipt.",
    x: 21,
    y: 74,
    suspicious: true,
  },
  {
    id: "chat",
    code: "E-04",
    time: "07:53",
    node: "Chat",
    snippet: "The agent asks you to stay in this chat and not to call anyone.",
    signal: "Pressure to stay isolated",
    alternative: "Leave the chat and ask someone you trust.",
    x: 57,
    y: 77,
    suspicious: false,
  },
  {
    id: "req",
    code: "E-05",
    time: "07:55",
    node: "Code request",
    snippet: "The page asks for a one-time code and shows a 04:59 countdown.",
    signal: "Urgency + secret code",
    alternative: "Stop. A real delivery never needs your one-time code.",
    x: 81,
    y: 42,
    suspicious: true,
  },
];

/** Undirected links between evidence nodes. */
export const links: ReadonlyArray<readonly [NodeId, NodeId]> = [
  ["msg", "site"],
  ["site", "req"],
  ["msg", "acct"],
  ["acct", "chat"],
  ["chat", "req"],
];

export function neighbors(id: NodeId): NodeId[] {
  return links.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : []));
}
