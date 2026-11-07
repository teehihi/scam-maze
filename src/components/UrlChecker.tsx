import { useMemo, useState } from "react";
import { analyzeUrl, type RiskLevel } from "../lib/urlCheck";
import { Marker, Section } from "./Section";

const examples = [
  "http://ghn-xacminh.top/otp",
  "https://shopee.vn.giao-hang-nhanh.xyz/login",
  "https://www.vietcombank.com.vn/",
];

const verdict: Record<Exclude<RiskLevel, "invalid">, { title: string; cls: string; marker: string; note: string }> = {
  high: {
    title: "Many high-risk signals",
    cls: "bg-red-100 text-red-950",
    marker: "bg-red-700",
    note: "Don't tap it and don't enter anything. Verify through an official channel you open yourself.",
  },
  medium: {
    title: "Suspicious signals found",
    cls: "bg-amber-100 text-amber-950",
    marker: "bg-amber-600",
    note: "Verify independently before you continue.",
  },
  "none-found": {
    title: "No warning signs found yet",
    cls: "bg-line text-ink",
    marker: "bg-muted",
    note: "This does NOT mean it is safe. The tool only analyzes the text of the URL and knows nothing about the page. Still verify through an official channel.",
  },
};

export function UrlChecker() {
  const [value, setValue] = useState("");
  const result = useMemo(() => analyzeUrl(value), [value]);
  const hasInput = value.trim().length > 0;

  return (
    <Section
      id="url-check"
      eyebrow="Real-life mode"
      title="Take the checklist to a URL check"
      intro="The analysis runs entirely in your browser with deterministic rules. The link you enter is never loaded or sent anywhere."
    >
      <div className="mx-auto max-w-3xl border border-line bg-surface p-5 sm:p-8">
        <label htmlFor="url-input" className="text-sm font-medium">
          Paste a URL to see its signals
        </label>
        <input
          id="url-input"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. http://ghn-xacminh.top/otp"
          className="mt-2 w-full border border-ink bg-surface px-4 py-3 font-mono text-sm placeholder:text-muted"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Try:</span>
          {examples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setValue(ex)}
              className="bg-paper px-2.5 py-1 font-mono text-xs hover:bg-line"
            >
              {ex}
            </button>
          ))}
        </div>

        <div className="mt-6" aria-live="polite">
          {hasInput && result.level === "invalid" && (
            <p className="bg-paper px-4 py-3 text-sm">This is not a valid http or https URL.</p>
          )}

          {result.level !== "invalid" && (
            <div>
              <div className={`px-4 py-3 ${verdict[result.level].cls}`}>
                <p className="font-semibold">{verdict[result.level].title}</p>
                <p className="mt-1 text-sm">{verdict[result.level].note}</p>
              </div>

              <p className="mt-4 font-mono text-xs text-muted">
                Registrable domain: <span className="text-ink">{result.registrableDomain}</span>
              </p>

              {result.signals.length > 0 && (
                <ul className="mt-3 border-t border-line">
                  {result.signals.map((s) => (
                    <li key={s.id} className="flex gap-3 border-b border-line py-3 text-sm">
                      <Marker className={verdict[result.level as Exclude<RiskLevel, "invalid">].marker} />
                      <span>
                        {s.label}
                        <span className="mt-0.5 block font-mono text-xs text-muted">{s.evidence}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}
