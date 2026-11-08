import { useEffect, useRef, useState } from "react";
import scarecrowWebp from "../../assets/halloween/scarecrow.webp";
import catWebp from "../../assets/halloween/step2-cat.webp";
import lanternWebp from "../../assets/halloween/step3-lantern.webp";
import witchWebp from "../../assets/halloween/step4-witch.webp";
import ghostImg from "../../assets/halloween/ghost.png";
import { EnterGameButton } from "../ui/GameEntry";
import { ChevronDown } from "lucide-react";
import { Reveal } from "../ui/Reveal";

interface InvestigationStep {
  num: string;
  name: string;
  desc: string;
  image: string;
  alt: string;
}

const steps: InvestigationStep[] = [
  {
    num: "01",
    name: "Discover",
    desc: "Intercept anomalous incoming messages, high-urgency notifications, and unexpected delivery holds. Learn to spot the subtle psychological hooks, artificial deadlines, and spoofed brand headers before they manipulate you into taking hasty, unverified actions.",
    image: scarecrowWebp,
    alt: "Halloween Scarecrow on pumpkin patch",
  },
  {
    num: "02",
    name: "Investigate",
    desc: "Interrogate digital evidence, TLS certificates, domain WHOIS records, and sender profile fingerprints. Trace multi-hop redirect chains, inspect look-alike clone portals, and systematically unmask fraudulent infrastructure using realistic cyber-forensic tools.",
    image: catWebp,
    alt: "Black cat with witch hat and ghost on pumpkin",
  },
  {
    num: "03",
    name: "Decide",
    desc: "Choose your branching path under simulated high-stakes time pressure. Every choice triggers realistic consequences in real-time — evaluate whether to cross-check through independent out-of-band channels or risk falling into a sophisticated digital trap.",
    image: lanternWebp,
    alt: "Spooky ghost with lantern and carved pumpkin",
  },
  {
    num: "04",
    name: "Uncover",
    desc: "Reveal the hidden deception graph and uncover the entire scam syndicate network behind the attack. Review interactive outcome debriefs, dissect failure points safely, and forge permanent cyber-investigator instincts that protect you and your peers in the real world.",
    image: witchWebp,
    alt: "Witch with potion bottle, black cat and pumpkin",
  },
];

export function InvestigateAndUncover() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState<number>(0);
  const step4EnterTimeRef = useRef<number>(0);
  const isAdvancingRef = useRef<boolean>(false);

  useEffect(() => {
    const handleScroll = () => {
      if ((window as unknown as { __isNavigating?: boolean }).__isNavigating) return;
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const scrollableHeight = rect.height - window.innerHeight;
      if (scrollableHeight <= 0) return;

      const scrolled = -rect.top;
      const progress = Math.max(0, Math.min(1, scrolled / scrollableHeight));

      // Divide scroll range into 4 distinct phases
      const stepIndex = Math.min(3, Math.floor(progress * 4));
      if (stepIndex === 3 && activeStep !== 3) {
        step4EnterTimeRef.current = Date.now();
      }
      setActiveStep(stepIndex);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [activeStep]);

  // Seamless jump to Section 4 on next scroll after reaching Step 04
  useEffect(() => {
    let lastWheelTime = 0;

    const advanceToNextSection = () => {
      if (isAdvancingRef.current) return;
      isAdvancingRef.current = true;
      const nextSection = document.getElementById("faq");
      if (nextSection) {
        nextSection.scrollIntoView({ behavior: "smooth" });
        setTimeout(() => {
          isAdvancingRef.current = false;
        }, 700);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      // If user is scrolling UP, immediately clear advance lock and let user scroll up freely!
      if (e.deltaY < -5) {
        isAdvancingRef.current = false;
        return;
      }

      if ((window as unknown as { __isNavigating?: boolean }).__isNavigating) return;
      if (activeStep !== 3 || e.deltaY <= 25) return;
      if (isAdvancingRef.current) return;

      // CRITICAL CHECK: ONLY advance if the user is actually at the bottom of Section 3,
      // NOT if the user has already scrolled into FAQ or is scrolling from below!
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const winH = window.innerHeight;
      
      // If the section top is not active, or user is already past section (in FAQ), never trigger!
      if (rect.top > 0 || rect.bottom < winH - 30) return;

      const now = Date.now();
      // Allow a brief window so Step 4 entrance is seen, then next scroll advances
      if (now - step4EnterTimeRef.current < 300) return;
      if (now - lastWheelTime < 800) return;
      lastWheelTime = now;

      advanceToNextSection();
    };

    let touchStartY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };
    const handleTouchMove = (e: TouchEvent) => {
      const touchY = e.touches[0].clientY;
      const deltaY = touchStartY - touchY;

      // If user is swiping UP to scroll UP, clear lock and return!
      if (deltaY < -5) {
        isAdvancingRef.current = false;
        return;
      }

      if (activeStep !== 3 || isAdvancingRef.current) return;
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const winH = window.innerHeight;
      if (rect.top > 0 || rect.bottom < winH - 30) return;

      const now = Date.now();
      if (deltaY > 35 && now - step4EnterTimeRef.current > 300) {
        advanceToNextSection();
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, [activeStep]);

  const scrollToStep = (index: number) => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    const scrollTop = window.scrollY + rect.top;
    const scrollableHeight = rect.height - window.innerHeight;
    const targetScroll = scrollTop + (index / 3.5) * scrollableHeight;
    window.scrollTo({ top: targetScroll, behavior: "smooth" });
  };

  return (
    <div
      ref={sectionRef}
      id="investigate"
      className="relative bg-[#f9fbf3] text-graphite h-[220vh]"
    >
      {/* Sticky viewport frame: remains pinned while user scrolls through the 4 steps */}
      <div className="sticky top-0 h-screen w-full flex flex-col justify-between overflow-hidden">
        
        {/* Top Wave Divider with Peek-a-boo Ghost (Permanently pinned at top as in ảnh 2) */}
        <div
          aria-hidden="true"
          className="relative w-full z-20 pointer-events-none select-none shrink-0"
        >
          <svg
            viewBox="0 0 1920 107"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-14 sm:h-18 md:h-22 lg:h-26 text-white block"
            preserveAspectRatio="none"
          >
            <path
              d="M 0,0 L 1920,0 L 1920,22 C 1780,42 1580,75 1380,75 C 1100,75 840,0 600,0 C 360,0 180,25 0,69 Z"
              fill="currentColor"
            />
          </svg>
          <img
            src={ghostImg}
            alt=""
            className="hidden sm:block absolute right-8 md:right-16 top-1 sm:top-2 w-16 sm:w-20 md:w-24 opacity-85 select-none animate-gentle-tilt-3 pointer-events-none"
          />
        </div>

        {/* Main Content Row */}
        <Reveal delay={0.1} className="mx-auto max-w-[76rem] w-full px-5 sm:px-8 my-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
            
            {/* Left Column: Changing Halloween Illustration with Smooth Entrance Animation */}
            <div className="lg:col-span-6 flex flex-col items-center justify-center order-2 lg:order-1">
              <div className="relative w-full max-w-[260px] sm:max-w-[360px] lg:max-w-[460px] aspect-square flex items-center justify-center">
                {/* Ambient glowing ground aura */}
                <div
                  aria-hidden="true"
                  className="absolute inset-x-8 bottom-2 sm:bottom-4 h-16 sm:h-24 rounded-full bg-purple/10 blur-2xl pointer-events-none"
                />

                {steps.map((step, idx) => {
                  const isActive = activeStep === idx;
                  return (
                    <div
                      key={step.num}
                      className={`absolute inset-0 flex items-center justify-center transition-all duration-700 ease-out ${
                        isActive
                          ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
                          : "opacity-0 scale-90 translate-y-8 pointer-events-none"
                      }`}
                    >
                      <img
                        src={step.image}
                        alt={step.alt}
                        className="max-h-full max-w-full object-contain select-none filter drop-shadow-[0_12px_28px_rgba(23,21,33,0.16)] animate-gentle-tilt-1"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Step indicator dots below character image */}
              <div className="mt-5 flex items-center gap-2">
                {steps.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => scrollToStep(idx)}
                    aria-label={`Jump to step ${idx + 1}`}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      activeStep === idx
                        ? "w-8 bg-purple"
                        : "w-2 bg-graphite/20 hover:bg-graphite/40"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Right Column: Pure Text Progression (Spotlight in-place transition) */}
            <div className="lg:col-span-6 flex flex-col justify-center max-w-xl mx-auto lg:mx-0 order-1 lg:order-2">
              <h2 className="spooky-script text-4xl sm:text-5xl lg:text-6xl text-[#171521] tracking-wide leading-tight mb-5 sm:mb-7 font-normal">
                Investigate & Uncover
              </h2>

              {/* Single Active Step Display (Smooth in-place transition without accumulating previous steps) */}
              <div className="relative min-h-[140px] sm:min-h-[170px]">
                {steps.map((step, idx) => {
                  const isActive = activeStep === idx;
                  return (
                    <div
                      key={step.num}
                      className={`transition-all duration-500 ease-out ${
                        isActive
                          ? "opacity-100 translate-y-0 relative pointer-events-auto"
                          : "opacity-0 translate-y-5 absolute inset-0 pointer-events-none"
                      }`}
                    >
                      <h3 className="spooky-script text-3xl sm:text-4xl lg:text-5xl text-[#171521] tracking-wide font-normal">
                        {step.num}. {step.name}
                      </h3>

                      <p className="stylish-text text-sm sm:text-base lg:text-lg text-graphite/80 leading-relaxed mt-2.5 sm:mt-3.5 max-w-xl font-normal">
                        {step.desc}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Step Counter & Scroll Advance Indicator */}
              <div className="mt-5 flex items-center gap-2 text-xs font-mono text-graphite/60">
                <span className="font-bold text-purple">{`0${activeStep + 1}`}</span>
                <span>/ 04</span>
                {activeStep < 3 ? (
                  <span className="ml-3 text-[11px] text-graphite/50 flex items-center gap-1">
                    Scroll down for next
                    <ChevronDown size={13} className="animate-bounce text-purple" />
                  </span>
                ) : (
                  <span className="ml-3 text-[11px] text-purple font-medium flex items-center gap-1">
                    Scroll down to explore FAQ
                    <ChevronDown size={13} className="animate-bounce text-purple" />
                  </span>
                )}
              </div>

              {/* Game Action Row (Clean dark button matching Gina reference) */}
              <div className="mt-8 flex flex-wrap items-center gap-4 pt-5 border-t border-graphite/10">
                <EnterGameButton variant="dark">
                  Enter the Maze
                </EnterGameButton>
                <div className="text-xs font-mono text-graphite/60 flex items-center gap-1.5">
                  <span>Scam Maze:</span>
                  <span className="font-semibold text-purple underline decoration-dashed underline-offset-4">
                    FREE TO PLAY
                  </span>
                </div>
              </div>

            </div>

          </div>
        </Reveal>

        {/* Bottom spacer to balance layout */}
        <div className="h-6 sm:h-10 shrink-0 pointer-events-none" />
      </div>
    </div>
  );
}
