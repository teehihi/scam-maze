import { REPO_URL } from "./Header";

const stats = [
  { k: "3 steps", v: "Scenario → Signals → Checklist" },
  { k: "100%", v: "Core runs offline, no AI needed" },
  { k: "0", v: "Real malicious links loaded" },
];

export function Hero() {
  return (
    <section id="top" className="px-5 pb-20 pt-20 sm:pt-28">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-medium text-accent-ink">Kiroween 2026 entry</p>

        <h1 className="mt-4 max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          Escape the scam <span className="bg-accent px-1.5">maze</span> before it leads you to a dead end.
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
          SCAMMAZE trains you to spot online traps through interactive scenarios. Every choice changes the story, every
          step reveals the warning signs, and you take the same checklist into real life.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <a href="#play" className="bg-ink px-6 py-3 font-semibold text-paper hover:bg-accent-ink">
            Play a scenario
          </a>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="border border-ink px-6 py-3 font-semibold hover:bg-ink hover:text-paper"
          >
            View source
          </a>
        </div>

        <dl className="mt-20 grid border-t border-line sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.k} className="border-b border-line py-6 sm:border-b-0 sm:pr-6">
              <dt className="text-3xl font-bold">{s.k}</dt>
              <dd className="mt-1 text-sm text-muted">{s.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
