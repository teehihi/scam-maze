import { useState } from "react";
import { CircleCheck, CircleHelp, OctagonAlert, RotateCcw } from "lucide-react";
import { branchChoices, branchPrompt, type BranchChoice, type BranchStatus } from "../../data/branching";
import { Reveal } from "../ui/Reveal";
import { SectionHeading } from "../ui/SectionHeading";

const statusStyle: Record<BranchStatus, { text: string; border: string; bg: string; line: string; Icon: typeof CircleCheck }> = {
  trapped: { text: "text-danger", border: "border-danger", bg: "bg-danger-fill/10", line: "bg-danger", Icon: OctagonAlert },
  unresolved: { text: "text-amber", border: "border-amber", bg: "bg-amber/10", line: "bg-amber", Icon: CircleHelp },
  contained: { text: "text-teal", border: "border-teal", bg: "bg-teal/10", line: "bg-teal", Icon: CircleCheck },
};

export function Branching() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [explored, setExplored] = useState<string[]>([]);
  const selected = branchChoices.find((c) => c.id === selectedId) ?? null;

  const choose = (c: BranchChoice) => {
    setSelectedId(c.id);
    setExplored((prev) => (prev.includes(c.id) ? prev : [...prev, c.id]));
  };
  const rewind = () => {
    setSelectedId(null);
  };

  return (
    <section id="branching" aria-labelledby="branching-title" className="relative border-t border-hairline px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto max-w-[76rem]">
        <SectionHeading
          id="branching-title"
          label="04 · The branches"
          lines={["One decision.", "A different story."]}
          intro="Try the preview. Pick a response and watch the story branch. Every outcome here is a simulated example, not the real mission engine."
        />

        <div className="mt-16 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-14">
          {/* Story + branches */}
          <Reveal className="lg:col-span-6">
            <div className="border border-hairline bg-navy p-5 sm:p-7">
              <p className="label text-[10px] text-lavender">Preview story · simulated</p>
              <div className="mt-4 border border-hairline bg-navy-2 p-4">
                <p className="label text-[10px] text-mist">{branchPrompt.from}</p>
                <p className="mt-2 text-sm leading-relaxed sm:text-base">{branchPrompt.message}</p>
              </div>

              <p id="branch-question" className="display mt-8 text-2xl">
                What do you do?
              </p>

              <div role="group" aria-labelledby="branch-question" className="relative mt-5">
                {/* Trunk */}
                <span aria-hidden="true" className="absolute bottom-8 left-3 top-0 w-px bg-hairline" />
                <ul className="space-y-3">
                  {branchChoices.map((c, i) => {
                    const active = selectedId === c.id;
                    const s = statusStyle[c.status];
                    return (
                      <li key={c.id} className="relative pl-10">
                        {/* Branch stub: lights up when this branch is taken */}
                        <span aria-hidden="true" className="absolute left-3 top-1/2 h-px w-7 bg-hairline" />
                        <span
                          aria-hidden="true"
                          className={`absolute left-3 top-1/2 h-px w-7 origin-left transition-transform duration-700 [transition-timing-function:var(--ease-out-expo)] ${s.line} ${
                            active ? "scale-x-100" : "scale-x-0"
                          }`}
                        />
                        <span
                          aria-hidden="true"
                          className={`absolute left-[0.4rem] top-1/2 size-2.5 -translate-y-1/2 border transition-colors duration-500 ${
                            active ? `${s.line} border-transparent` : "border-hairline bg-graphite"
                          }`}
                        />
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => choose(c)}
                          className={`group flex w-full items-center gap-4 border px-4 py-4 text-left transition-colors duration-300 ${
                            active
                              ? `${s.border} ${s.bg}`
                              : selected
                                ? "border-hairline opacity-60 hover:border-lavender hover:opacity-100"
                                : "border-hairline hover:border-lavender"
                          }`}
                        >
                          <span className="label grid size-7 shrink-0 place-items-center border border-current text-[11px] text-lavender">
                            {i + 1}
                          </span>
                          <span className="flex-1 text-sm font-semibold sm:text-base">{c.label}</span>
                          {active && (
                            <span className={`label flex items-center gap-1.5 text-[10px] ${s.text}`}>
                              <s.Icon size={14} aria-hidden="true" />
                              Chosen
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="mt-6 flex items-center justify-between gap-4 border-t border-hairline pt-4">
                <p className="label text-[10px] text-mist" aria-live="polite">
                  Paths explored: {explored.length} of {branchChoices.length}
                </p>
                <button
                  type="button"
                  onClick={rewind}
                  disabled={!selected}
                  className="label flex items-center gap-2 text-[10px] text-lavender transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RotateCcw size={13} aria-hidden="true" />
                  Rewind
                </button>
              </div>
            </div>
          </Reveal>

          {/* Consequence */}
          <Reveal delay={0.1} className="lg:col-span-6">
            <div aria-live="polite" className="relative min-h-[26rem] border border-hairline bg-navy p-5 sm:p-7">
              <p className="label flex items-center gap-2 text-[10px] text-amber">
                <span aria-hidden="true" className="size-1.5 bg-amber" />
                Simulated outcome · illustration only
              </p>

              {!selected ? (
                <div className="flex h-[22rem] flex-col items-center justify-center text-center">
                  <p className="display text-3xl text-mist">The story is waiting.</p>
                  <p className="mt-3 max-w-xs text-sm text-mist">Choose a response on the left to see where it leads.</p>
                </div>
              ) : (
                <Outcome key={selected.id} choice={selected} onPick={choose} />
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Outcome({ choice, onPick }: { choice: BranchChoice; onPick: (c: BranchChoice) => void }) {
  const s = statusStyle[choice.status];
  const others = branchChoices.filter((c) => c.id !== choice.id);
  return (
    <div className="dialog-in">
      <p className={`label mt-6 inline-flex items-center gap-2 border px-3 py-1.5 text-[11px] ${s.text} ${s.border} ${s.bg}`}>
        <s.Icon size={14} aria-hidden="true" />
        {choice.statusLabel}
      </p>
      <h3 className="display mt-4 text-3xl sm:text-4xl">{choice.outcomeTitle}</h3>
      <p className="mt-4 text-sm leading-relaxed text-mist sm:text-base">{choice.outcome}</p>

      <div className="mt-6 border-t border-hairline pt-5">
        <p className="label text-[10px] text-lavender">{choice.status === "trapped" ? "Signals passed by" : "Signals noticed"}</p>
        <ul className="mt-3 space-y-2 text-sm">
          {choice.missedOrNoticed.map((m) => (
            <li key={m} className="flex gap-3">
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 bg-lavender" />
              {m}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 border-t border-hairline pt-5">
        <p className="label text-[10px] text-lavender">Another decision, another story</p>
        <ul className="mt-3 space-y-2">
          {others.map((o) => {
            const os = statusStyle[o.status];
            return (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => onPick(o)}
                  className="group flex w-full items-start gap-3 border border-hairline px-3 py-3 text-left transition-colors hover:border-lavender"
                >
                  <os.Icon size={16} aria-hidden="true" className={`mt-0.5 shrink-0 ${os.text}`} />
                  <span className="text-sm">
                    <span className="block font-semibold">If you chose: {o.label}</span>
                    <span className="mt-0.5 block text-mist">
                      {o.statusLabel}. {o.teaser}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
