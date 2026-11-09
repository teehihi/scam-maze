import heroBg from "../../assets/halloween/hero1.png";
import batImg from "../../assets/halloween/bat.png";
import wavImg from "../../assets/halloween/wav.png";
import { EnterGameButton } from "../ui/GameEntry";
import { Reveal } from "../ui/Reveal";

export function Hero() {
  return (
    <section
      id="top"
      className="relative isolate min-h-[100vh] flex flex-col justify-between pt-24 sm:pt-28 pb-36 sm:pb-48 text-center overflow-hidden"
      style={{
        backgroundImage: `radial-gradient(circle at 50% 35%, rgba(60, 50, 95, 0.08), rgba(23, 21, 33, 0.38)), url(${heroBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Floating Animated Bat */}
      <img
        src={batImg}
        alt=""
        aria-hidden="true"
        width={68}
        className="animation-bat pointer-events-none absolute right-8 sm:right-16 top-20 sm:top-24 z-20 drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
      />

      {/* Atmospheric Glow Overlays */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-graphite/15 via-transparent to-graphite/35"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/3 -z-10 size-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple/35 blur-[140px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 bottom-24 -z-10 size-[32rem] -translate-x-1/2 rounded-full bg-amber/15 blur-[100px]"
      />

      <div className="mx-auto max-w-4xl px-5 sm:px-8 my-auto relative z-10">
        <Reveal delay={0.05}>
          {/* Luminous Headline */}
          <h1 className="display relative text-5xl sm:text-7xl md:text-8xl tracking-wide leading-tight">
            <span className="bg-gradient-to-b from-white via-ivory to-lavender/90 bg-clip-text text-transparent drop-shadow-[0_4px_28px_rgba(118,84,214,0.75)]">
              The Scam Maze
            </span>
          </h1>
        </Reveal>

        <Reveal delay={0.15}>
          {/* Glowing Subtitle in Spooky Script */}
          <p className="spooky-script mt-2 text-3xl sm:text-4xl md:text-5xl text-lavender font-semibold drop-shadow-[0_0_25px_rgba(185,165,245,0.6)]">
            Can you find your way out?
          </p>
        </Reveal>

        <Reveal delay={0.25}>
          {/* Short Subtext */}
          <p className="mt-5 max-w-xl mx-auto text-base sm:text-lg text-mist leading-relaxed">
            Step into a digital world where every message hides a trap, every link deserves a second look, and every decision changes the story.
          </p>
        </Reveal>

        <Reveal delay={0.35}>
          {/* Action Controls */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <EnterGameButton
              variant="primary"
              className="!min-h-12 !px-8 !text-sm shadow-[0_0_25px_rgba(118,84,214,0.55)] hover:shadow-[0_0_35px_rgba(185,165,245,0.7)] hover:scale-105 transition-all"
            >
              Enter The Maze
            </EnterGameButton>
            <a
              href="#investigate"
              className="btn btn-ghost !min-h-12 !px-7 !text-sm border-hairline/80 bg-navy/60 backdrop-blur-sm hover:border-lavender hover:text-lavender hover:bg-navy/80 hover:scale-102 transition-all"
            >
              Explore The Investigation
            </a>
          </div>
        </Reveal>
      </div>

      {/* Wave bottom transition divider into Section 2 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -bottom-[1px] h-28 sm:h-40 md:h-48 lg:h-52 w-full bg-bottom bg-repeat-x opacity-100 z-20"
        style={{
          backgroundImage: `url(${wavImg})`,
          backgroundSize: "100% 100%",
        }}
      />
    </section>
  );
}
