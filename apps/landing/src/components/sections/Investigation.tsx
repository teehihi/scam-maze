import type { ReactNode } from "react";
import { InViewGroup, Reveal } from "../ui/Reveal";
import { SectionHeading } from "../ui/SectionHeading";

interface Step {
  name: string;
  text: string;
  artifact: ReactNode;
}

const steps: Step[] = [
  {
    name: "Discover",
    text: "Encounter suspicious events and gather initial information.",
    artifact: (
      <div className="space-y-2 text-xs">
        <p className="label text-[10px] text-lavender">Incoming · 3 events</p>
        {[
          ["07:42", "Text from an unknown number"],
          ["07:44", "Email about the same parcel"],
          ["07:51", "A “support agent” joins the chat"],
        ].map(([t, e]) => (
          <div key={t} className="flex items-center gap-3 border border-hairline bg-navy-2 px-3 py-2.5">
            <span className="font-mono text-mist">{t}</span>
            <span>{e}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    name: "Investigate",
    text: "Inspect messages, websites, profiles, identities, and evidence.",
    artifact: (
      <div className="relative border border-hairline bg-navy-2 p-4 text-xs">
        <p className="leading-relaxed">
          Confirm your address at{" "}
          <span className="border-b border-amber bg-amber/10 px-1 font-mono text-amber">swiftparcel-verify.test</span>
        </p>
        <div className="mt-3 border-l-2 border-lavender bg-graphite p-3">
          <p className="label text-[10px] text-lavender">Inspecting · address</p>
          <p className="mt-1.5 leading-relaxed text-mist">
            The courier’s own address in this world is <span className="font-mono text-ivory">swiftparcel.example</span>. This
            one is different.
          </p>
        </div>
      </div>
    ),
  },
  {
    name: "Decide",
    text: "Choose how to respond based on the available information.",
    artifact: (
      <div className="space-y-2 text-xs">
        {["Follow the link", "Ask the sender", "Check with the courier directly"].map((o, i) => (
          <div
            key={o}
            className={`flex items-center gap-3 border px-3 py-3 ${
              i === 2 ? "border-lavender bg-purple/20" : "border-hairline bg-navy-2"
            }`}
          >
            <span className={`grid size-5 place-items-center border font-mono text-[10px] ${i === 2 ? "border-lavender text-lavender" : "border-hairline text-mist"}`}>
              {i + 1}
            </span>
            {o}
          </div>
        ))}
      </div>
    ),
  },
  {
    name: "Uncover",
    text: "Understand the consequences and learn from the evidence.",
    artifact: (
      <div className="border border-hairline bg-navy-2 p-4 text-xs">
        <p className="label text-[10px] text-lavender">Replay · simulated</p>
        <ol className="relative mt-4 space-y-4 border-l border-hairline pl-5">
          {[
            ["You opened the link", "Missed: the address did not match", true],
            ["You were asked for a code", "Missed: urgency countdown", true],
            ["Another path", "You could have checked the courier directly", false],
          ].map(([a, b, missed]) => (
            <li key={String(a)} className="relative">
              <span
                aria-hidden="true"
                className={`absolute -left-[1.6rem] top-1 size-2.5 ${missed ? "bg-amber" : "border border-lavender bg-graphite"}`}
              />
              <p className="font-semibold">{a}</p>
              <p className="mt-0.5 text-mist">{b}</p>
            </li>
          ))}
        </ol>
      </div>
    ),
  },
];

export function Investigation() {
  return (
    <section id="investigation" aria-labelledby="investigation-title" className="relative border-t border-hairline px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto max-w-[76rem]">
        <SectionHeading
          id="investigation-title"
          label="03 · The method"
          lines={["Don’t just play the story.", "Uncover what’s hidden."]}
          intro="Every case moves through four stages. Each one asks you to look a little closer."
        />

        <InViewGroup className="relative mt-20">
          {/* Spine */}
          <div aria-hidden="true" className="absolute bottom-0 left-4 top-0 w-px lg:left-1/2">
            <div className="grow-y h-full w-px bg-gradient-to-b from-lavender via-purple to-amber/70" />
          </div>

          <ol className="space-y-20 lg:space-y-28">
            {steps.map((s, i) => {
              const flip = i % 2 === 1;
              return (
                <li key={s.name} className="relative grid items-center gap-8 pl-12 lg:grid-cols-2 lg:gap-24 lg:pl-0">
                  <span
                    aria-hidden="true"
                    className="absolute left-4 top-3 size-3.5 -translate-x-1/2 border-2 border-graphite bg-lavender lg:left-1/2 lg:top-1/2 lg:-translate-y-1/2"
                  />
                  <Reveal className={flip ? "lg:order-2 lg:pl-0" : "lg:text-right"}>
                    <p
                      aria-hidden="true"
                      className="display text-[clamp(5rem,12vw,9rem)] leading-[0.8] text-transparent [-webkit-text-stroke:1px_var(--color-purple)]"
                    >
                      0{i + 1}
                    </p>
                    <h3 className="display -mt-2 text-4xl sm:text-5xl">{s.name}</h3>
                    <p className={`mt-4 max-w-sm text-base leading-relaxed text-mist ${flip ? "" : "lg:ml-auto"}`}>{s.text}</p>
                  </Reveal>
                  <Reveal delay={0.15} className={flip ? "lg:order-1" : ""}>
                    <div aria-hidden="true" className={`max-w-md ${flip ? "lg:ml-auto" : ""}`}>
                      {s.artifact}
                    </div>
                  </Reveal>
                </li>
              );
            })}
          </ol>
        </InViewGroup>
      </div>
    </section>
  );
}
