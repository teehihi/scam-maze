/**
 * Deterministic URL heuristics: string analysis ONLY.
 * Never loads the page, never makes a network request, never opens the link.
 *
 * Principle: the result is NEVER "safe". No bad signals ≠ safe.
 */

export type RiskLevel = "high" | "medium" | "none-found" | "invalid";

export interface Signal {
  id: string;
  weight: number;
  label: string;
  evidence: string;
}

export interface UrlAnalysis {
  level: RiskLevel;
  score: number;
  hostname: string;
  registrableDomain: string;
  signals: Signal[];
}

const RISKY_TLDS = new Set([
  "top", "xyz", "click", "icu", "vip", "cfd", "sbs", "rest", "zip", "mov", "gq", "tk", "ml", "cf",
]);

const SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "cutt.ly", "rb.gy", "s.id", "shorturl.at",
]);

/** Commonly impersonated brands → their official registrable domains. */
const BRANDS: Record<string, string[]> = {
  vietcombank: ["vietcombank.com.vn"],
  momo: ["momo.vn"],
  shopee: ["shopee.vn", "shopee.com"],
  zalo: ["zalo.me", "zaloapp.com"],
  facebook: ["facebook.com", "fb.com"],
  google: ["google.com", "google.com.vn"],
  paypal: ["paypal.com"],
  tiktok: ["tiktok.com"],
  ghn: ["ghn.vn"],
  viettel: ["viettel.vn", "viettelpost.vn"],
  vnpost: ["vnpost.vn"],
};

/**
 * Path keywords that suggest a sensitive action. Detection data, not UI copy:
 * includes Vietnamese slugs seen in real scam URLs (xacminh = verify,
 * dangnhap = log in, thanhtoan = payment, trungthuong = prize,
 * khoa-tai-khoan = account locked).
 */
const PATH_KEYWORDS = ["otp", "verify", "xacminh", "xac-minh", "login", "dangnhap", "thanhtoan", "trungthuong", "khoa-tai-khoan", "unlock"];

const SECOND_LEVEL = new Set(["com", "net", "org", "gov", "edu", "co"]);

function registrable(hostname: string): string {
  if (isIpv4(hostname)) return hostname;
  const labels = hostname.split(".");
  if (labels.length <= 2) return hostname;
  const last = labels[labels.length - 1];
  const second = labels[labels.length - 2];
  // e.g. *.com.vn, *.co.uk
  if (last.length === 2 && SECOND_LEVEL.has(second)) return labels.slice(-3).join(".");
  return labels.slice(-2).join(".");
}

function isIpv4(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

export function analyzeUrl(raw: string): UrlAnalysis {
  const input = raw.trim();
  const empty: UrlAnalysis = {
    level: "invalid",
    score: 0,
    hostname: "",
    registrableDomain: "",
    signals: [],
  };
  if (!input || /\s/.test(input)) return empty;

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input);
  let url: URL;
  try {
    url = new URL(hasScheme ? input : `https://${input}`);
  } catch {
    return empty;
  }
  if (!["http:", "https:"].includes(url.protocol)) return empty;

  const hostname = url.hostname.toLowerCase();
  const domain = registrable(hostname);
  const tld = hostname.split(".").pop() ?? "";
  const signals: Signal[] = [];
  const add = (id: string, weight: number, label: string, evidence: string) =>
    signals.push({ id, weight, label, evidence });

  if (hasScheme && url.protocol === "http:")
    add("no-https", 1, "Does not use HTTPS", `Protocol: ${url.protocol}//`);

  if (isIpv4(hostname))
    add("ip-host", 3, "Uses an IP address instead of a domain name", hostname);

  if (hostname.split(".").some((l) => l.startsWith("xn--")))
    add("punycode", 3, "Punycode domain (may imitate look-alike characters)", hostname);

  if (url.username || url.password || input.includes("@"))
    add("userinfo", 3, "Contains “@” or login details in the URL", "The part before @ can hide the real domain");

  if (RISKY_TLDS.has(tld))
    add("risky-tld", 2, "Domain ending that is often abused", `.${tld}`);

  if (SHORTENERS.has(hostname))
    add("shortener", 2, "Link shortener hides the real destination", hostname);

  if (!isIpv4(hostname) && hostname.split(".").length >= 5)
    add("deep-subdomain", 1, "Too many subdomain levels", hostname);

  if ((hostname.match(/-/g) ?? []).length >= 3)
    add("many-hyphens", 1, "Domain contains many hyphens", hostname);

  for (const [brand, officials] of Object.entries(BRANDS)) {
    if (hostname.includes(brand) && !officials.includes(domain)) {
      add(
        `brand-${brand}`,
        3,
        `Mentions “${brand}”, but the registrable domain is not theirs`,
        `Actual registrable domain: ${domain}`,
      );
      break;
    }
  }

  const pathLower = (url.pathname + url.search).toLowerCase();
  const hit = PATH_KEYWORDS.find((k) => pathLower.includes(k));
  if (hit)
    add("urgent-path", 1, "Path suggests a sensitive action", `Contains “${hit}”`);

  if (input.length > 100)
    add("long-url", 1, "Very long URL", `${input.length} characters`);

  const score = signals.reduce((s, x) => s + x.weight, 0);
  const level: RiskLevel = score >= 4 ? "high" : score >= 2 ? "medium" : "none-found";
  return { level, score, hostname, registrableDomain: domain, signals };
}
