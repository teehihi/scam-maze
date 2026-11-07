import { MazeMotif } from "../art/MazeMotif";
import { EnterGameButton } from "../ui/GameEntry";
import { Reveal } from "../ui/Reveal";

export function FinalCta() {
  return (
    <section id="enter" aria-labelledby="final-title" className="relative isolate overflow-hidden border-t border-hairline px-5 py-28 sm:px-8 sm:py-40">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="glow-purple absolute inset-0" />
        <div className="grid-lines absolute inset-0" />
        <MazeMotif className="absolute left-1/2 top-1/2 size-[70rem] max-w-none -translate-x-1/2 -translate-y-1/2 text-lavender/[0.1]" />
      </div>

      <Reveal className="mx-auto max-w-3xl text-center">
        <h2 id="final-title" className="display text-[clamp(2.75rem,9vw,6.5rem)]">
          The maze
          <span className="block text-lavender">is waiting.</span>
        </h2>
        <p className="mx-auto mt-8 max-w-md text-base leading-relaxed text-mist sm:text-lg">
          Explore the signals. Question the obvious. Discover what lies beneath the surface.
        </p>
        <div className="mt-10 flex justify-center">
          <EnterGameButton className="!min-h-14 !px-9" />
        </div>
        <p className="label mt-10 text-[11px] text-lavender">Stay curious. Stay aware.</p>
      </Reveal>
    </section>
  );
}
