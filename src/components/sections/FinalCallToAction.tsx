import { useState, useRef, useEffect } from "react";
import pumpkin1 from "../../assets/halloween/pumpkin1.png";
import pumpkin2 from "../../assets/halloween/pumpkin2.png";
import pumpkin3 from "../../assets/halloween/pumpkin3.png";
import pumpkin4 from "../../assets/halloween/pumpkin4.png";
import pumpkin5 from "../../assets/halloween/pumpkin5.png";
import pumpkin6 from "../../assets/halloween/pumpkin6.png";
import ghostImg from "../../assets/halloween/ghost.png";
import batImg from "../../assets/halloween/bat.png";
import spiderWebLeft from "../../assets/halloween/spiderweb.webp";
import spiderWebRight from "../../assets/halloween/spiderweb1.webp";
import wav3Img from "../../assets/halloween/wav3.png";
import { Reveal } from "../ui/Reveal";

interface FaqItem {
  id: number;
  question: string;
  answer: string;
  category: string;
  img: string;
}

const faqData: FaqItem[] = [
  {
    id: 1,
    question: "What is SCAMMAZE?",
    answer:
      "SCAMMAZE is a browser-based, first-person 3D narrative game where you explore an everyday world, investigate suspicious situations, and make decisions that shape your story.",
    category: "Game Overview",
    img: pumpkin1,
  },
  {
    id: 2,
    question: "How do I play SCAMMAZE?",
    answer:
      "Explore the environment, interact with characters and objects, investigate suspicious messages, and gather clues. Your decisions influence how each situation unfolds.",
    category: "Gameplay & Controls",
    img: pumpkin2,
  },
  {
    id: 3,
    question: "Are the scam scenarios based on real cases?",
    answer:
      "Our scenarios are inspired by common real-world scam tactics, including fake delivery notifications, fraudulent job offers, and impersonation. All characters, brands, and events are fictionalized.",
    category: "Realistic Scenarios",
    img: pumpkin3,
  },
  {
    id: 4,
    question: "Do I need cybersecurity knowledge to play?",
    answer:
      "Not at all! SCAMMAZE is designed for everyone. Learn through exploration, investigation, and the consequences of your decisions.",
    category: "Player Accessibility",
    img: pumpkin4,
  },
  {
    id: 5,
    question: "Do my choices affect the story?",
    answer:
      "Yes! Your decisions can lead to different outcomes, reveal new information, and influence how later events unfold. Every choice is part of your investigation.",
    category: "Branching Narrative",
    img: pumpkin5,
  },
  {
    id: 6,
    question: "Is SCAMMAZE a scam detection tool?",
    answer:
      "No. SCAMMAZE is an interactive learning game, not a real-time scam detection service. It helps you develop better judgment by letting you experience and investigate scam scenarios firsthand.",
    category: "Educational Simulator",
    img: pumpkin6,
  },
];

export function FinalCallToAction() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = faqData[activeIndex];

  const pumpkinRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [indicatorOffset, setIndicatorOffset] = useState({ top: 0, height: 52 });
  const [spiderWebVisible, setSpiderWebVisible] = useState(true);

  useEffect(() => {
    const checkVisibility = () => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const winH = window.innerHeight;
      // When FAQ section is visible on screen, spiderwebs are displayed
      const inView = rect.top < winH + 100 && rect.bottom > -50;
      setSpiderWebVisible(inView);
    };

    window.addEventListener("scroll", checkVisibility, { passive: true });
    window.addEventListener("resize", checkVisibility, { passive: true });
    checkVisibility();
    return () => {
      window.removeEventListener("scroll", checkVisibility);
      window.removeEventListener("resize", checkVisibility);
    };
  }, []);

  useEffect(() => {
    const updateIndicator = () => {
      const activeBtn = pumpkinRefs.current[activeIndex];
      const track = trackRef.current;
      if (activeBtn && track) {
        const btnRect = activeBtn.getBoundingClientRect();
        const trackRect = track.getBoundingClientRect();
        const top = btnRect.top - trackRect.top + (btnRect.height - 52) / 2;
        setIndicatorOffset({
          top: Math.max(0, top),
          height: 52,
        });
      }
    };

    updateIndicator();
    const rafId = requestAnimationFrame(updateIndicator);
    const timer = setTimeout(updateIndicator, 60);

    window.addEventListener("resize", updateIndicator);
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timer);
      window.removeEventListener("resize", updateIndicator);
    };
  }, [activeIndex]);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="faq-section-title"
      className="relative bg-white text-graphite overflow-hidden"
    >
      {/* Corner Spider Web - Top Left (Shrinks to corner vertex when scrolled away) */}
      <div
        className={`pointer-events-none absolute -top-1 -left-1 z-10 select-none origin-top-left transition-all duration-400 ease-out ${
          spiderWebVisible ? "scale-100 opacity-30" : "scale-0 opacity-0"
        }`}
      >
        <img
          src={spiderWebLeft}
          alt=""
          aria-hidden="true"
          className="size-16 sm:size-20 md:size-24 -rotate-90 select-none filter contrast-125"
        />
      </div>

      {/* Corner Spider Web - Top Right (Shrinks to corner vertex when scrolled away) */}
      <div
        className={`pointer-events-none absolute -top-1 -right-1 z-10 select-none origin-top-right transition-all duration-400 ease-out ${
          spiderWebVisible ? "scale-100 opacity-30" : "scale-0 opacity-0"
        }`}
      >
        <img
          src={spiderWebRight}
          alt=""
          aria-hidden="true"
          className="size-16 sm:size-20 md:size-24 select-none filter contrast-125"
        />
      </div>

      {/* Bat flying along the outer right edge (separated from corner web) */}
      <img
        src={batImg}
        alt=""
        aria-hidden="true"
        className="absolute top-12 sm:top-16 right-6 sm:right-10 md:right-14 w-10 sm:w-13 opacity-85 select-none pointer-events-none z-10"
      />

      {/* Ghost floating gently in place ("lướt ngay, kiểu bay bay") along the outer bottom-right edge */}
      <img
        src={ghostImg}
        alt=""
        aria-hidden="true"
        className="absolute right-6 sm:right-10 md:right-14 lg:right-18 bottom-28 sm:bottom-36 md:bottom-44 lg:bottom-52 w-20 sm:w-26 md:w-30 lg:w-34 select-none opacity-85 animate-ghost-float pointer-events-none z-10"
      />

      {/* FAQ Section matching Gina template (White background) */}
      <div
        id="faq"
        className="relative mx-auto max-w-5xl px-6 sm:px-10 pt-8 sm:pt-12 pb-16 sm:pb-24 flex flex-col items-center min-h-[80vh]"
      >

        {/* Section Header */}
        <Reveal delay={0.05} className="text-center max-w-2xl mx-auto mb-6 sm:mb-8">
          <h2
            id="faq-section-title"
            className="spooky-script text-4xl sm:text-5xl lg:text-6xl text-[#1d1b2b] tracking-wide leading-tight font-normal mt-1"
          >
            Frequently Asked <span className="text-[#7654d6]">Questions</span>
          </h2>
          <p className="font-sans text-sm sm:text-base text-[#6c757d] mt-2">
            Everything you need to know about navigating and playing inside the maze.
          </p>
        </Reveal>

        {/* Centered tight flex container matching Gina reference template */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12 lg:gap-16 w-full max-w-3xl lg:max-w-4xl mx-auto mt-2 sm:mt-4">
          {/* Left Column: 6 Pumpkins + Vertical Sliding Teal Indicator */}
          <Reveal delay={0.15} className="flex items-stretch gap-6 sm:gap-8 shrink-0">
            {/* Pumpkins stack */}
            <div className="flex flex-row md:flex-col items-center justify-center gap-3 sm:gap-3.5 shrink-0 flex-wrap">
              {faqData.map((item, idx) => {
                const isSelected = activeIndex === idx;
                return (
                  <button
                    key={item.id}
                    ref={(el) => {
                      pumpkinRefs.current[idx] = el;
                    }}
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    className={`group relative transition-all duration-300 transform select-none p-1.5 rounded-2xl cursor-pointer ${
                      isSelected
                        ? "opacity-100 animate-pumpkin-pop drop-shadow-sm"
                        : "opacity-25 hover:opacity-75 scale-95 grayscale-[15%]"
                    }`}
                    aria-label={`View FAQ: ${item.question}`}
                  >
                    <img
                      src={item.img}
                      alt=""
                      className="size-14 sm:size-16 lg:size-[68px] object-contain transition-transform duration-300 group-hover:rotate-3"
                    />
                  </button>
                );
              })}
            </div>

            {/* Vertical Sliding Indicator Track (Teal bar shifting to match active question) */}
            <div
              ref={trackRef}
              aria-hidden="true"
              className="hidden md:block relative w-[3px] shrink-0"
            >
              {/* Subtle guide track */}
              <div className="absolute inset-y-0 left-0 w-[2px] bg-slate-200/50 rounded-full" />

              {/* Sliding teal indicator bar */}
              <div
                className="absolute left-[-0.5px] w-[3.5px] bg-[#5cc8b2] rounded-full transition-all duration-300 ease-out"
                style={{
                  top: `${indicatorOffset.top}px`,
                  height: `${indicatorOffset.height}px`,
                }}
              />
            </div>
          </Reveal>

          {/* Right Column: Question Title & Answer */}
          <Reveal delay={0.25} className="flex-1 max-w-xl text-left pl-0 md:pl-2">
            <div
              key={active.id}
              className="animate-faq-switch"
            >

              {/* Question Title in Spooky Script Font */}
              <h3
                id="faq-title"
                className="spooky-script text-3xl sm:text-4xl lg:text-[44px] text-[#1d1b2b] tracking-wide leading-tight font-normal"
              >
                {active.question}
              </h3>

              {/* Answer Text in Clean Font */}
              <p className="font-sans text-base sm:text-lg lg:text-[19px] text-[#555a64] leading-relaxed mt-4 font-normal">
                {active.answer}
              </p>

              {/* Subtitle Line matching John Santiago - California */}
              <div className="mt-8 pt-4 border-t border-slate-100/80 text-sm sm:text-base">
                <span className="font-bold text-[#1d1b2b]">SCAMMAZE</span>
                <span className="text-[#888e99]"> — {active.category}</span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      {/* Wave bottom transition divider into dark footer ("chuyển màu sang màu tối mà không bị gắt") */}
      <div
        aria-hidden="true"
        className="pointer-events-none relative w-full h-24 sm:h-32 md:h-40 lg:h-48 bg-[#171521] -mb-[1px] overflow-hidden"
      >
        {/* 1px white line to eliminate any fractional pixel sub-raster gap */}
        <div className="absolute top-0 inset-x-0 h-1 bg-white z-10" />
        <div
          className="w-full h-full bg-top bg-no-repeat relative z-0"
          style={{
            backgroundImage: `url(${wav3Img})`,
            backgroundSize: "100% 100%",
          }}
        />
      </div>
    </section>
  );
}
