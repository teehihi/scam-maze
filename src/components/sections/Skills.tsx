import { useState } from "react";
import { skills } from "../../data/skills";
import { MazeMotif } from "../art/MazeMotif";
import { InViewGroup, Reveal } from "../ui/Reveal";
import { SectionHeading } from "../ui/SectionHeading";

const CENTER = { x: 50, y: 50 };

export function Skills() {
  const [selectedId, setSelectedId] = useState(skills[0].id);
  const selected = skills.find((s) => s.id === selectedId) ?? skills[0];

  return (
    <section id="about" aria-labelledby="skills-title" className="relative overflow-hidden border-t border-hairline px-5 py-24 sm:px-8 sm:py-32">
      <div className="relative mx-auto grid max-w-[76rem] grid-cols-1 items-center gap-14 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SectionHeading
            id="skills-title"
            label="07 · Your digital survival DNA"
            lines={["Become a better", "investigator."]}
            intro="SCAMMAZE is built around practical habits. Skills are meant to grow through the decisions you make, the practice you repeat and the time you spend reflecting on what happened."
          />

          <Reveal delay={0.15} className="mt-10">
            <div aria-live="polite" className="border-l-2 border-lavender bg-navy p-5">
              <p className="label text-[10px] text-lavender">Selected skill</p>
              <h3 className="display mt-2 text-2xl">{selected.name}</h3>
              <p className="mt-3 text-lg font-semibold text-lilac">“{selected.question}”</p>
              <p className="mt-2 text-sm leading-relaxed text-mist">{selected.practised}</p>
            </div>
            <p className="mt-5 max-w-md text-xs leading-relaxed text-mist">
              These are habits to practise, not scores. Playing a game cannot guarantee safety in real life, and SCAMMAZE
              never claims it can.
            </p>
          </Reveal>
        </div>

        <div className="lg:col-span-7">
          <InViewGroup className="relative mx-auto aspect-square w-full max-w-[34rem]">
            <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" className="absolute inset-0 h-full w-full">
              {/* Outer ring */}
              <circle cx="50" cy="50" r="40" fill="none" stroke="#38344f" strokeWidth="0.25" strokeDasharray="1 1.5" />
              <circle cx="50" cy="50" r="24" fill="none" stroke="#38344f" strokeWidth="0.25" strokeDasharray="1 1.5" />
              {/* Constellation links between neighbours */}
              {skills.map((s, i) => {
                const n = skills[(i + 1) % skills.length];
                return (
                  <line
                    key={`edge-${s.id}`}
                    className="draw"
                    pathLength={1}
                    style={{ ["--d" as string]: `${0.2 + i * 0.15}s` }}
                    x1={s.x}
                    y1={s.y}
                    x2={n.x}
                    y2={n.y}
                    stroke="#7654d6"
                    strokeWidth="0.35"
                  />
                );
              })}
              {/* Spokes to the centre; the selected one is lit */}
              {skills.map((s, i) => {
                const lit = s.id === selected.id;
                return (
                  <line
                    key={`spoke-${s.id}`}
                    className="draw"
                    pathLength={1}
                    style={{ ["--d" as string]: `${0.9 + i * 0.1}s` }}
                    x1={CENTER.x}
                    y1={CENTER.y}
                    x2={s.x}
                    y2={s.y}
                    stroke={lit ? "#b9a5f5" : "#38344f"}
                    strokeWidth={lit ? 0.6 : 0.3}
                  />
                );
              })}
            </svg>

            {/* Centre */}
            <div className="absolute left-1/2 top-1/2 grid size-24 -translate-x-1/2 -translate-y-1/2 place-items-center border border-lavender/50 bg-graphite">
              <MazeMotif className="size-14 text-lavender" weight={5} />
            </div>
            <p className="label absolute left-1/2 top-[62%] -translate-x-1/2 text-[9px] text-mist">You</p>

            {/* Skill nodes */}
            {skills.map((s, i) => {
              const active = s.id === selected.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedId(s.id)}
                  style={{ left: `${s.x}%`, top: `${s.y}%` }}
                  className="group absolute flex w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 text-center sm:w-32"
                >
                  <span
                    className={`relative grid size-9 place-items-center border font-mono text-xs transition-all duration-500 ${
                      active
                        ? "scale-110 border-lavender bg-purple text-white"
                        : "border-hairline bg-navy-2 text-mist group-hover:border-lavender group-hover:text-white"
                    }`}
                  >
                    {i + 1}
                    {active && <span aria-hidden="true" className="absolute -inset-2 border border-lavender/40" />}
                  </span>
                  <span className={`text-[11px] font-semibold leading-tight sm:text-xs ${active ? "text-white" : "text-mist group-hover:text-ivory"}`}>
                    {s.name}
                  </span>
                </button>
              );
            })}
          </InViewGroup>
        </div>
      </div>
    </section>
  );
}
