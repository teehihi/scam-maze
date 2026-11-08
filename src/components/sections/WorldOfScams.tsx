import witchHatSvg from "../../assets/halloween/halloween-witch-hat.svg";
import pumpkinSvg from "../../assets/halloween/halloween-pumpkin-head-outlined-smile.svg";
import phantomSvg from "../../assets/halloween/halloween-phantom-outline.svg";
import { Reveal } from "../ui/Reveal";

interface FeatureColumn {
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  animationClass: string;
}

const features: FeatureColumn[] = [
  {
    icon: witchHatSvg,
    title: "Optical Illusions",
    subtitle: "Clone Portals & Fake Marketplaces",
    description:
      "Spoofed security seals, look-alike domain addresses, and cloned storefronts designed to deceive your eyes and disarm your skepticism at first glance.",
    animationClass: "animate-gentle-tilt-1",
  },
  {
    icon: pumpkinSvg,
    title: "Psychological Pressure",
    subtitle: "Messages, Banking & OTP",
    description:
      "Manufactured 30-minute deadlines, fake delivery holds, and alarming fraud alerts engineered to hijack your rational mind with panic before you can pause.",
    animationClass: "animate-gentle-tilt-2",
  },
  {
    icon: phantomSvg,
    title: "Social Engineering",
    subtitle: "Ghost Guides & Impostors",
    description:
      "Helpful fake support agents and phantom profiles who systematically steer you away from official channels while harvesting private one-time authorization codes.",
    animationClass: "animate-gentle-tilt-3",
  },
];

export function WorldOfScams() {
  return (
    <section
      aria-labelledby="world-title"
      className="relative isolate min-h-[100vh] lg:h-screen lg:max-h-screen flex flex-col justify-between bg-white text-graphite pt-6 sm:pt-10 pb-0 overflow-hidden"
    >
      {/* Anchor placed lower down so clicking pulls the content higher up on screen */}
      <div id="world" className="absolute top-24 sm:top-32 pointer-events-none" />

      <div className="mx-auto max-w-[76rem] px-5 sm:px-8 my-auto relative z-10 w-full">
        {/* Centered Heading and Short Subtitle using Spooky Script Font */}
        <Reveal delay={0.05} className="text-center max-w-3xl mx-auto">
          <h2
            id="world-title"
            className="spooky-script text-4xl sm:text-5xl lg:text-6xl text-[#1d1b2b] tracking-wide leading-tight font-normal"
          >
            A World Behind{" "}
            <span className="text-purple">Your Screen</span>
          </h2>
          <p className="spooky-script text-xl sm:text-2xl lg:text-3xl text-graphite/75 font-normal leading-snug mt-1 max-w-2xl mx-auto">
            Step into the three deception arts that scammers weave across the digital landscape to trap the unwary.
          </p>
        </Reveal>

        {/* Clean, Spacious Three-Column Feature Layout — Matching Reference Image */}
        <div className="mt-8 sm:mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 items-start">
          {features.map((feature, idx) => (
            <Reveal key={feature.title} delay={0.15 + idx * 0.12} className="h-full">
              <div className="flex flex-col items-center text-center px-2 sm:px-4">
                {/* Hand-Drawn Halloween Illustration — Original Black Doodles with in-place gentle wobble */}
                <div className="flex h-20 sm:h-24 items-center justify-center mb-2">
                  <img
                    src={feature.icon}
                    alt=""
                    aria-hidden="true"
                    className={`size-16 sm:size-20 select-none ${feature.animationClass}`}
                  />
                </div>

                {/* Column Title in Spooky Script Font */}
                <h3 className="spooky-script text-2xl sm:text-3xl lg:text-4xl text-[#1d1b2b] font-normal tracking-wide mt-2">
                  {feature.title}
                </h3>

                {/* Subtitle */}
                <p className="font-mono text-[11px] sm:text-xs font-semibold text-purple tracking-wider uppercase mt-1 mb-2.5">
                  {feature.subtitle}
                </p>

                {/* Concise Description */}
                <p className="stylish-text text-sm sm:text-[15px] text-graphite/70 leading-relaxed max-w-xs sm:max-w-sm">
                  {feature.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
