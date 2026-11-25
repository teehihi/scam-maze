// The virtual websites of the in-game browser. A site is data that ships with the game: a canonical
// address, an id, a kind and i18n keys under `laptop.browser.sites.<id>`. Nothing is loaded from
// the Internet and no iframe is used; an address that is not in this list is an error page. Later
// missions add their pages by appending to `VIRTUAL_PAGES`.
//
// `kind: "parcel"` is Mission 02's redelivery page: one form, one optional fee, no steps.
// `kind: "static"` pages are plain text pages. `kind: "portal"` pages are the simulated student
// portal of UEH (the valid site of the story). `kind: "clearance"` pages are the look-alike
// "graduation clearance" site that the story's email links to: its steps are the game's own device
// item (`page.fee`) actions, so the browser adds no rules to the story.
// Every site is a simulation made for the game. None of them is, or claims to be, an official site.
import { HISTORY_URL, NEW_TAB_URL, parseAddress, isInternalUrl } from "./urls";

export type VirtualPageKind = "static" | "portal" | "clearance" | "parcel";
export type PortalSection = "dashboard" | "thesis" | "services" | "account";
export type ClearanceStep = "notice" | "login" | "payment" | "verify" | "complete";

export interface VirtualPage {
  id: string;
  /** Canonical address, written as `parseAddress` would. */
  url: string;
  kind: VirtualPageKind;
  /** Portal pages: which part of the portal. */
  section?: PortalSection;
  /** Clearance pages: which step of the look-alike site. */
  step?: ClearanceStep;
  /** Part of the bookmark menu from the start. */
  bookmarkedByDefault?: boolean;
}

export const VIRTUAL_PAGES: readonly VirtualPage[] = [
  { id: "portal", url: "https://student.ueh.edu.vn/", kind: "portal", section: "dashboard", bookmarkedByDefault: true },
  { id: "portal-thesis", url: "https://student.ueh.edu.vn/thesis", kind: "portal", section: "thesis" },
  { id: "portal-services", url: "https://student.ueh.edu.vn/services", kind: "portal", section: "services" },
  { id: "portal-account", url: "https://student.ueh.edu.vn/account", kind: "portal", section: "account" },
  { id: "library", url: "https://lib.ueh.edu.vn/hours", kind: "static", bookmarkedByDefault: true },
  { id: "fee", url: "https://payment-ueh.vn/confirm", kind: "clearance", step: "notice" },
  { id: "fee-login", url: "https://payment-ueh.vn/login", kind: "clearance", step: "login" },
  { id: "fee-payment", url: "https://payment-ueh.vn/payment", kind: "clearance", step: "payment" },
  { id: "fee-verify", url: "https://payment-ueh.vn/verify", kind: "clearance", step: "verify" },
  { id: "fee-complete", url: "https://payment-ueh.vn/complete", kind: "clearance", step: "complete" },
  // Mission 02: the courier's redelivery page. `parcel` kind, because it asks for details and money
  // in one step (the clearance site's stepper would be a lie: there is nothing to sign in to).
  { id: "parcel", url: "https://tochhanh24.example/redelivery", kind: "parcel" },
];

export type Route =
  | { type: "internal"; id: "newtab" | "history" }
  | { type: "page"; page: VirtualPage }
  | { type: "error"; reason: "invalid" | "unreachable"; url: string };

/** Pages are matched on host and path; a query string or a trailing slash does not change the page. */
function pageKey(host: string, path: string): string {
  return `${host}${path.length > 1 ? path.replace(/\/+$/, "") : path}`;
}

const PAGE_BY_KEY: ReadonlyMap<string, VirtualPage> = new Map(
  VIRTUAL_PAGES.flatMap((page) => {
    const parsed = parseAddress(page.url);
    return parsed ? [[pageKey(parsed.host, parsed.path), page] as const] : [];
  }),
);

export function resolveRoute(url: string): Route {
  if (url === NEW_TAB_URL) return { type: "internal", id: "newtab" };
  if (url === HISTORY_URL) return { type: "internal", id: "history" };
  const parsed = parseAddress(url);
  if (parsed === null) return { type: "error", reason: "invalid", url };
  const page = PAGE_BY_KEY.get(pageKey(parsed.host, parsed.path));
  return page ? { type: "page", page } : { type: "error", reason: "unreachable", url: parsed.url };
}

/** The canonical address of the page an address leads to, so two spellings of one page are one entry. */
export function canonicalPageUrl(url: string): string {
  const route = resolveRoute(url);
  return route.type === "page" ? route.page.url : url;
}

/** Only addresses that lead to a real page of the game can be bookmarked or enter the history. */
export function isKnownPage(url: string): boolean {
  return resolveRoute(url).type === "page";
}

export function defaultBookmarks(): string[] {
  return VIRTUAL_PAGES.filter((page) => page.bookmarkedByDefault).map((page) => page.url);
}

/** The canonical address of a page of the game, by its id. Throws for an unknown id: that is a programming error. */
export function urlOfPage(id: string): string {
  const page = VIRTUAL_PAGES.find((entry) => entry.id === id);
  if (!page) throw new Error(`Unknown virtual page: ${id}`);
  return page.url;
}
export { isInternalUrl };
