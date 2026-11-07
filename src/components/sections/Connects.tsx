import type { ReactNode } from "react";
import { ArrowRight, ArrowDown } from "lucide-react";
import { InViewGroup, Reveal } from "../ui/Reveal";
import { SectionHeading } from "../ui/SectionHeading";

interface Stage {
  key: string;
  name: string;
  text: string;
  leadsTo?: string;
  visual: ReactNode;
}

const stages: Stage[] = [
  {
    key: "message",
    name: "Message",
    text: "A harmless-looking note arrives: a parcel, a prize, a friend in need.",
    leadsTo: "Its link opens a page",
    visual: (
      <div className="space-y-2">
        <p className="label text-[9px] text-mist">Text message · unknown number</p>
        <div className="border border-hairline bg-navy-2 p-3 text-xs leading-relaxed">
          Your parcel is on hold. Confirm here:{" "}
          <span className="font-mono text-amber">swiftparcel-verify.test</span>
        </div>
      </div>
    ),
  },
  {
    key: "website",
    name: "Website",
    text: "The page looks right at a glance. The small details are what give it away.",
    leadsTo: "The page invites a chat",
    visual: (
      <div className="border border-hairline bg-graphite">
        <div className="truncate border-b border-hairline px-2 py-1.5 font-mono text-[10px] text-mist">swiftparcel-verify.test/otp</div>
        <div className="space-y-2 p-3">
          <div className="h-2 w-2/3 bg-hairline" />
          <div className="h-6 border border-hairline" />
          <div className="h-6 bg-purple/70" />
        </div>
      </div>
    ),
  },
  {
    key: "conversation",
    name: "Conversation",
    text: "A friendly voice guides every step and keeps you inside the chat.",
    leadsTo: "A deadline appears",
    visual: (
      <div className="space-y-2 text-xs">
        <div className="max-w-[85%] border border-hairline bg-navy-2 p-2.5">Hi, I’m Dana from support. I’ll help you.</div>
        <div className="ml-auto max-w-[85%] bg-purple/80 p-2.5 text-white">What do you need?</div>
        <div className="max-w-[85%] border border-hairline bg-navy-2 p-2.5">Please stay in this chat.</div>
      </div>
    ),
  },
  {
    key: "decision",
    name: "Decision",
    text: "Pressure peaks. One choice remains: act now, or step outside the story and check.",
    visual: (
      <div className="border border-hairline bg-navy-2 p-3 text-center">
        <p className="label text-[9px] text-danger">Time left 04:59</p>
        <p className="mt-2 text-sm font-semibold">Send the code now?</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-semibold tracking-widest">
          <span className="border border-danger/60 py-2 text-danger">SEND</span>
          <span className="border border-lavender/60 py-2 text-lavender">CHECK FIRST</span>
        </div>
      </div>
    ),
  },
];

export function Connects() {
  return (
    <section id="experience" aria-labelledby="connects-title" className="relative px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto max-w-[76rem]">
        <SectionHeading
          id="connects-title"
          label="01 · The thread"
          lines={["Everything connects.", "Nothing is what it seems."]}
        />
        <Reveal delay={0.1} className="mt-8 max-w-2xl space-y-4 text-base leading-relaxed text-mist sm:text-lg">
          <p>
            A scam rarely begins with an obvious warning. It can start with a harmless-looking message, lead to a website,
            continue through a conversation, and eventually create pressure to make a decision.
          </p>
          <p className="text-ivory">In SCAMMAZE, one investigation can run through all of these places at once.</p>
        </Reveal>

        <InViewGroup className="mt-16">
          {/* Rail: draws itself across the four stages */}
          <div aria-hidden="true" className="relative mb-10 hidden h-px lg:block">
            <div className="grow-x absolute inset-0 bg-gradient-to-r from-lavender via-lavender/60 to-amber" style={{ ["--d" as string]: "0.2s" }} />
          </div>

          <div className="relative">
          {/* Mobile rail */}
          <span aria-hidden="true" className="absolute bottom-4 left-[0.45rem] top-4 w-px bg-hairline lg:hidden" />
          <ol className="grid gap-0 lg:grid-cols-4 lg:gap-8">
            {stages.map((s, i) => (
              <li key={s.key} className="relative pb-12 pl-9 last:pb-0 lg:pb-0 lg:pl-0">
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-1.5 size-[0.95rem] border-2 border-graphite lg:-top-[3.15rem] ${
                    i === stages.length - 1 ? "bg-amber" : "bg-lavender"
                  }`}
                />
                <Reveal delay={0.15 + i * 0.18}>
                  <p className="label text-lavender">
                    0{i + 1} · {s.key}
                  </p>
                  <h3 className="display mt-3 text-3xl">{s.name}</h3>
                  <div className="mt-5 min-h-[9.5rem] border-t border-hairline pt-5">{s.visual}</div>
                  <p className="mt-5 text-sm leading-relaxed text-mist">{s.text}</p>
                  {s.leadsTo && (
                    <p className="label mt-5 flex items-center gap-2 text-[10px] text-lavender">
                      <ArrowRight size={14} aria-hidden="true" className="hidden lg:block" />
                      <ArrowDown size={14} aria-hidden="true" className="lg:hidden" />
                      {s.leadsTo}
                    </p>
                  )}
                </Reveal>
              </li>
            ))}
          </ol>
          </div>
        </InViewGroup>
      </div>
    </section>
  );
}
