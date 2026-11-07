import type { ReactNode } from "react";
import { missions, type Mission } from "../../data/missions";
import { Reveal } from "../ui/Reveal";
import { SectionHeading } from "../ui/SectionHeading";

/** Distinct evidence artwork per case, so the three files never read as one template. */
const artwork: Record<Mission["id"], ReactNode> = {
  "001": (
    <div className="relative h-52">
      <div className="case-peek absolute inset-x-0 top-0 border border-hairline bg-navy-2 p-3 text-xs">
        <p className="label text-[9px] text-lavender">Text · unknown number</p>
        <p className="mt-1.5 leading-snug">Order #SP-88213 is on hold. Confirm in 30 minutes.</p>
      </div>
      <div className="case-peek absolute inset-x-5 top-[4.5rem] border border-amber/50 bg-graphite p-3 font-mono text-[11px] text-amber">
        swiftparcel-verify.test/otp
      </div>
      <div className="case-peek absolute inset-x-10 top-[8rem] border border-hairline bg-navy-2 p-3 text-center">
        <p className="label text-[9px] text-danger">Code requested · 04:59</p>
        <div className="mt-2 flex justify-center gap-1">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className="size-5 border border-hairline bg-graphite" />
          ))}
        </div>
      </div>
    </div>
  ),
  "002": (
    <div className="case-peek relative h-52 bg-lilac p-4 text-graphite">
      <p className="label text-[9px] text-purple">Offer of employment · draft</p>
      <p className="mt-2 font-display text-lg font-extrabold leading-tight">Remote coordinator</p>
      <div className="mt-3 space-y-1.5">
        <div className="h-1.5 w-full bg-graphite/20" />
        <div className="h-1.5 w-5/6 bg-graphite/20" />
      </div>
      <p className="mt-4 inline-block border border-graphite px-2 py-1 font-mono text-[11px] font-semibold">
        Onboarding fee due before day one
      </p>
    </div>
  ),
  "003": (
    <div className="case-peek relative h-52">
      <div className="flex gap-3 border border-hairline bg-navy-2 p-3">
        <div aria-hidden="true" className="relative size-16 shrink-0 bg-gradient-to-br from-purple to-graphite">
          <div className="absolute bottom-0 left-2 h-8 w-5 bg-lavender/70" />
        </div>
        <div className="text-xs">
          <p className="label text-[9px] text-mist">Listing</p>
          <p className="mt-1 font-semibold">Studio headphones</p>
          <p className="mt-1 text-amber">Priced far below similar items</p>
        </div>
      </div>
      <div className="mt-3 ml-auto max-w-[80%] bg-purple p-3 text-xs text-white">Send the deposit by direct transfer. Quick!</div>
    </div>
  ),
};

export function Missions() {
  return (
    <section id="missions" aria-labelledby="missions-title" className="relative border-t border-hairline px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto max-w-[76rem]">
        <SectionHeading
          id="missions-title"
          label="06 · The cases"
          lines={["Every case", "has a story."]}
          intro="The first three planned cases. They are in development: none of them can be played yet."
        />

        <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-6">
          {missions.map((m, i) => (
            <Reveal key={m.id} as="article" delay={i * 0.12} className={i === 1 ? "lg:mt-14" : i === 2 ? "lg:mt-28" : ""}>
              <div className="case-file relative border border-hairline bg-navy">
                {/* Folder tab */}
                <div className="absolute -top-px left-5 -translate-y-full border border-b-0 border-hairline bg-navy px-3 py-1.5">
                  <p className="label text-[10px] text-lavender">Case {m.id}</p>
                </div>

                <div className="p-6 sm:p-7">
                  <div className="flex items-center justify-between gap-3">
                    <p className="label text-[10px] text-mist">{m.category}</p>
                    <p className="label border border-amber/50 px-2 py-1 text-[9px] text-amber">Coming soon</p>
                  </div>

                  <div aria-hidden="true" className="mt-6 overflow-hidden">
                    {artwork[m.id]}
                  </div>

                  <h3 className="display mt-6 text-3xl">{m.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-mist">{m.hook}</p>

                  <p className="label mt-6 text-[10px] text-lavender">Core themes</p>
                  <ul className="mt-3 divide-y divide-hairline border-y border-hairline text-sm">
                    {m.themes.map((t) => (
                      <li key={t} className="flex items-center gap-3 py-2.5">
                        <span aria-hidden="true" className="size-1.5 bg-lavender" />
                        {t}
                      </li>
                    ))}
                  </ul>

                  <p className="label mt-6 text-[10px] text-mist">Upcoming case · not yet playable</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
