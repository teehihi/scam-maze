import { useState } from "react";
import { GitBranch, Globe, KeyRound, MessageSquare, MessagesSquare, UserRound } from "lucide-react";
import { evidence, links, neighbors, type Evidence, type NodeId } from "../../data/investigation";
import { Reveal } from "../ui/Reveal";
import { SectionHeading } from "../ui/SectionHeading";

const nodeIcon = {
  msg: MessageSquare,
  site: Globe,
  acct: UserRound,
  chat: MessagesSquare,
  req: KeyRound,
} as const;

const byId = Object.fromEntries(evidence.map((e) => [e.id, e])) as Record<NodeId, Evidence>;

function PanelTitle({ n, name, text }: { n: string; name: string; text: string }) {
  return (
    <header>
      <p className="label text-[10px] text-lavender">
        System {n}
      </p>
      <h3 className="display mt-2 text-2xl sm:text-3xl">{name}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-mist">{text}</p>
    </header>
  );
}

export function Systems() {
  const [sel, setSel] = useState<NodeId>("site");
  const current = byId[sel];
  const related = neighbors(sel);

  const select = (id: NodeId) => setSel(id);

  return (
    <section id="systems" aria-labelledby="systems-title" className="relative border-t border-hairline px-5 py-24 sm:px-8 sm:py-32">
      <div aria-hidden="true" className="glow-purple pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative mx-auto max-w-[76rem]">
        <SectionHeading
          id="systems-title"
          label="05 · The tools"
          lines={["Follow the evidence."]}
          intro="Three systems, one investigation. Select anything below: the same clue lights up on the board, the network and the replay."
        />

        <Reveal delay={0.1} className="mt-14">
          <div className="border border-hairline bg-navy">
            {/* Workspace bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline bg-navy-2 px-4 py-2.5">
              <p className="label text-[10px] text-lavender">Case 001 · Investigation workspace</p>
              <p className="label text-[10px] text-mist">Fictional data · hand-authored links</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12">
              {/* A · Evidence board */}
              <div className="border-b border-hairline p-5 sm:p-7 lg:col-span-4 lg:border-b-0 lg:border-r">
                <PanelTitle
                  n="A"
                  name="Evidence Board"
                  text="Suspicious signals pinned to the evidence that supports them."
                />
                <ul className="mt-6 space-y-2.5">
                  {evidence.map((e) => {
                    const active = e.id === sel;
                    const isRelated = related.includes(e.id);
                    return (
                      <li key={e.id}>
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => select(e.id)}
                          className={`w-full border p-3.5 text-left transition-colors duration-300 ${
                            active
                              ? "border-lavender bg-purple/25"
                              : isRelated
                                ? "border-lavender/50 bg-navy-2"
                                : "border-hairline bg-navy-2 hover:border-lavender/60"
                          }`}
                        >
                          <span className="label flex items-center justify-between text-[10px]">
                            <span className="text-lavender">{e.code}</span>
                            <span className="text-mist">{e.time}</span>
                          </span>
                          <span className="mt-1.5 block text-[13px] leading-snug">{e.snippet}</span>
                          <span className="label mt-2.5 flex items-center gap-2 text-[10px] text-amber">
                            <span aria-hidden="true" className="size-1.5 bg-amber" />
                            {e.signal}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* B · Trust network */}
              <div className="p-5 sm:p-7 lg:col-span-8">
                <PanelTitle
                  n="B"
                  name="Trust Network"
                  text="How accounts, websites, messages and events are connected."
                />

                <div className="relative mt-6 aspect-[4/5] w-full sm:aspect-[16/9]">
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    focusable="false"
                    className="absolute inset-0 h-full w-full"
                  >
                    {links.map(([a, b]) => {
                      const A = byId[a];
                      const B = byId[b];
                      const lit = a === sel || b === sel;
                      return (
                        <line
                          key={`${a}-${b}`}
                          x1={A.x}
                          y1={A.y}
                          x2={B.x}
                          y2={B.y}
                          vectorEffect="non-scaling-stroke"
                          stroke={lit ? "#b9a5f5" : "#38344f"}
                          strokeWidth={lit ? 2 : 1}
                          strokeDasharray={lit ? undefined : "4 4"}
                          className="transition-[stroke] duration-500"
                        />
                      );
                    })}
                  </svg>

                  {evidence.map((e) => {
                    const Icon = nodeIcon[e.id];
                    const active = e.id === sel;
                    const isRelated = related.includes(e.id);
                    return (
                      <button
                        key={e.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => select(e.id)}
                        style={{ left: `${e.x}%`, top: `${e.y}%` }}
                        className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 border px-2.5 py-2 text-left text-xs transition-all duration-500 ${
                          active
                            ? "z-10 scale-105 border-lavender bg-purple text-white"
                            : isRelated
                              ? "border-lavender/70 bg-navy-2"
                              : "border-hairline bg-navy-2 text-mist hover:border-lavender/60 hover:text-ivory"
                        }`}
                      >
                        <Icon size={14} aria-hidden="true" />
                        <span className="whitespace-nowrap font-semibold">{e.node}</span>
                        {e.suspicious && (
                          <span className="label hidden text-[9px] text-amber sm:inline">
                            <span className="sr-only">Suspicious signal. </span>
                            <span aria-hidden="true">!</span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Selected detail */}
                <div aria-live="polite" className="mt-6 grid gap-5 border-t border-hairline pt-5 sm:grid-cols-2">
                  <div>
                    <p className="label text-[10px] text-lavender">
                      Selected · {current.code} · {current.time}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed">{current.snippet}</p>
                  </div>
                  <div>
                    <p className="label text-[10px] text-lavender">Connected to</p>
                    <p className="mt-2 text-sm text-mist">{related.map((r) => byId[r].node).join(" · ")}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* C · Consequence replay */}
            <div className="border-t border-hairline p-5 sm:p-7">
              <PanelTitle
                n="C"
                name="Consequence Replay"
                text="Review your decisions, the signals you missed and the paths you did not take. Simulated consequences only."
              />
              <ol className="mt-8 grid gap-0 sm:grid-cols-5">
                {evidence.map((e, i) => {
                  const active = e.id === sel;
                  return (
                    <li key={e.id} className="relative">
                      {/* connector */}
                      <span
                        aria-hidden="true"
                        className={`absolute left-4 top-4 hidden h-px sm:block ${i === evidence.length - 1 ? "w-0" : "w-full"} ${
                          active ? "bg-lavender" : "bg-hairline"
                        }`}
                      />
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => select(e.id)}
                        className="group relative flex w-full items-start gap-4 pb-6 text-left sm:flex-col sm:gap-3 sm:pb-0 sm:pr-3"
                      >
                        <span
                          aria-hidden="true"
                          className={`relative z-10 grid size-8 shrink-0 place-items-center border font-mono text-[10px] transition-colors ${
                            active
                              ? "border-lavender bg-purple text-white"
                              : "border-hairline bg-navy text-mist group-hover:border-lavender"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <span>
                          <span className="label block text-[10px] text-mist">{e.time}</span>
                          <span className={`mt-1 block text-[13px] font-semibold ${active ? "text-white" : ""}`}>{e.signal}</span>
                          {e.suspicious && (
                            <span className="label mt-1.5 block text-[10px] text-amber">Signal missed</span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>

              <div aria-live="polite" className="mt-6 flex items-start gap-3 border border-dashed border-lavender/50 bg-purple/10 p-4">
                <GitBranch size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-lavender" />
                <p className="text-sm leading-relaxed">
                  <span className="label mr-2 text-[10px] text-lavender">Alternative path at {current.code}</span>
                  {current.alternative}
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        <p className="mt-6 max-w-2xl text-xs leading-relaxed text-mist">
          This is an illustration of planned systems using fictional data. The connections shown are authored by designers.
          SCAMMAZE does not claim automatic detection or verification.
        </p>
      </div>
    </section>
  );
}
