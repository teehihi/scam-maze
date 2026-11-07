import { Marker, Section } from "./Section";

const traps = [
  { name: "Strange links", text: "Messages with shortened links or fake brand names." },
  { name: "Prize wins", text: "“You've won a gift”, just pay a small fee or log in." },
  { name: "Fake jobs", text: "Easy work, high pay, and a request for a deposit or an app install." },
  { name: "OTP requests", text: "A “verification” excuse to get the code that approves your transaction." },
  { name: "Fake login pages", text: "Looks identical, but the domain is off by one character." },
];

export function Problem() {
  return (
    <Section
      id="problem"
      eyebrow="The problem"
      title="Everyone knows “be careful”. Few notice when they are being led."
      intro="Scammers rarely strike in a single move. They create pressure, then walk you through small steps that each sound reasonable, until it is too late."
    >
      <ul className="border-t border-line">
        {traps.map((t, i) => (
          <li key={t.name} className="grid gap-1 border-b border-line py-5 sm:grid-cols-[3rem_14rem_1fr] sm:gap-6">
            <span className="font-mono text-sm text-muted">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="font-semibold">{t.name}</h3>
            <p className="text-muted">{t.text}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

const loop = [
  {
    title: "Learn the scenario",
    text: "Step into a branching story. Your choices decide whether you move on, stop, or get trapped.",
  },
  {
    title: "Spot the signals",
    text: "After each step, the system points out red flags with evidence (message excerpts, domains) and an independent way to verify.",
  },
  {
    title: "Apply the checklist",
    text: "Use the same rules in URL check mode and in real situations, before you click, type, or send money.",
  },
];

export function Loop() {
  return (
    <Section
      id="loop"
      eyebrow="Learning loop"
      title="Not just a quiz. A loop that turns into a habit."
      intro="Players carry the exact checklist they practiced in the game into real situations."
    >
      <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
        {loop.map((s, i) => (
          <li key={s.title} className="border-t-2 border-ink pt-5">
            <span className="font-mono text-sm text-accent-ink">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="mt-2 text-xl font-semibold">{s.title}</h3>
            <p className="mt-2 leading-relaxed text-muted">{s.text}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

const features = [
  ["Branching scenarios", "A state-machine engine with curated JSON scenarios that run fully offline."],
  ["Deterministic risk rules", "URL and hostname heuristics run in the browser, with repeatable, explainable results."],
  ["Transparent evidence", "Every warning comes with a concrete excerpt. No mystery scores."],
  ["Scenario authoring", "Editors create, check and approve new scenarios as scam tactics change."],
  ["Learning analytics", "Track recognition of new situations through pre/post tests, not just in-game scores."],
  ["Optional AI", "Natural-language explanations and scenario drafts for human review. Turn AI off and everything still works."],
];

export function Features() {
  return (
    <Section id="features" eyebrow="Features" title="What's inside the maze">
      <div className="grid gap-x-12 sm:grid-cols-2">
        {features.map(([t, d]) => (
          <article key={t} className="border-t border-line py-6">
            <h3 className="font-semibold">{t}</h3>
            <p className="mt-2 leading-relaxed text-muted">{d}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}

const stack = ["React 19", "TypeScript", "Vite 8", "Tailwind CSS v4", "State machine", "Scenario JSON", "pnpm"];

const kiroItems = [
  { t: "Specs", d: "Define every scenario's state transitions precisely before writing code." },
  { t: "Steering", d: "A hard rule: the system never claims that a URL is “safe”." },
  { t: "Hooks", d: "Automatically test every scenario branch, and verify that no dangerous page is ever loaded." },
];

export function KiroSection() {
  return (
    <Section
      id="kiro"
      eyebrow="Built with Kiro"
      title="Specs, steering and hooks keep the product safe by design"
      intro="In a safety education project, small mistakes can create false trust. Kiro turns our principles into constraints we can verify."
    >
      <div className="grid gap-10 md:grid-cols-3 md:gap-8">
        {kiroItems.map((k) => (
          <article key={k.t} className="border-t-2 border-ink pt-5">
            <h3 className="font-mono text-sm font-medium uppercase tracking-widest">{k.t}</h3>
            <p className="mt-3 leading-relaxed text-muted">{k.d}</p>
          </article>
        ))}
      </div>
      <ul className="mt-12 flex flex-wrap gap-2" aria-label="Tech stack">
        {stack.map((s) => (
          <li key={s} className="bg-line px-3 py-1 font-mono text-xs">
            {s}
          </li>
        ))}
      </ul>
    </Section>
  );
}

const risks = [
  { r: "Overconfidence from the game", m: "We always remind players that finishing a scenario does not make them immune." },
  {
    r: "Wrong URL heuristics (false positives and negatives)",
    m: "Never declare a link “safe”. Only show signals and recommend independent verification.",
  },
  { r: "Scenarios go out of date fast", m: "An authoring tool and a review process keep up with new tactics." },
];

export function Risks() {
  return (
    <Section id="risks" eyebrow="Honest about risks" title="We set our own conditions for calling this project a failure">
      <div className="grid gap-12 lg:grid-cols-2">
        <ul className="border-t border-line">
          {risks.map((x) => (
            <li key={x.r} className="flex gap-4 border-b border-line py-5">
              <Marker className="bg-accent" />
              <div>
                <p className="font-semibold">{x.r}</p>
                <p className="mt-1 text-muted">{x.m}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="bg-ink p-8 text-paper">
          <p className="font-mono text-xs font-medium uppercase tracking-widest text-accent">Kill test</p>
          <p className="mt-4 text-lg leading-relaxed">
            If recognition of <strong>new situations</strong> does not improve in pre/post tests, or the system says
            “safe” just because <strong>no bad signals</strong> were found, we consider the hypothesis wrong.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-zinc-300">
            Anti-scam education games already exist. SCAMMAZE has to prove that it changes behavior, not just add spooky
            visuals.
          </p>
        </div>
      </div>
    </Section>
  );
}
