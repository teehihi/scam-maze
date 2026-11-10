import { useState, useEffect } from "react";
import spiderWebLeft from "../../assets/halloween/spiderweb.webp";
import spiderWebRight from "../../assets/halloween/spiderweb1.webp";
import spiderImg from "../../assets/halloween/spider.webp";
import pumpkinImg from "../../assets/halloween/hanging-pumpkin.webp";
import batImg from "../../assets/halloween/hanging-bat.webp";
import kiroGhostImg from "../../assets/halloween/kiro-ghost.png";
import ghostSpookyImg from "../../assets/halloween/ghost-spooky.png";
import { useScrolled } from "../../hooks/useScrolled";

/**
 * Hanging Halloween interactive decoration:
 * - Corner spider webs on top-left and top-right.
 * - Silk threads anchored permanently at the ceiling (top: 0).
 * - 5 characters: Bat (12%), Spooky Ghost (30%), Spider (50%), Kiro (68%), Pumpkin (84%).
 * - Threads extend/unreel smoothly downwards, lowering the characters.
 * - When scrolling away, threads reel back up to height: 0, pulling characters cleanly into ceiling.
 */
export function HangingHalloween() {
  const scrolled = useScrolled(25);
  const [batTease, setBatTease] = useState(false);
  const [spookyGhostTease, setSpookyGhostTease] = useState(false);
  const [spiderTease, setSpiderTease] = useState(false);
  const [kiroTease, setKiroTease] = useState(false);
  const [pumpkinTease, setPumpkinTease] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile, { passive: true });
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-40 overflow-visible"
    >
      {/* Corner Spider Web - Left */}
      <div
        className={`pointer-events-none absolute left-0 top-0 transition-all duration-500 ease-out ${
          scrolled
            ? "-translate-y-12 -translate-x-12 opacity-0"
            : "translate-y-0 translate-x-0 opacity-70"
        }`}
      >
        <img
          src={spiderWebLeft}
          alt=""
          className="size-16 sm:size-24 md:size-28 -rotate-90 select-none filter brightness-105"
        />
      </div>

      {/* Corner Spider Web - Right */}
      <div
        className={`pointer-events-none absolute right-0 top-0 transition-all duration-500 ease-out ${
          scrolled
            ? "-translate-y-12 translate-x-12 opacity-0"
            : "translate-y-0 translate-x-0 opacity-70"
        }`}
      >
        <img
          src={spiderWebRight}
          alt=""
          className="size-16 sm:size-24 md:size-28 select-none filter brightness-105"
        />
      </div>

      {/* 1 · Hanging Bat - Far Left */}
      <div
        style={{ left: "12%" }}
        className="absolute top-0 flex flex-col items-center pointer-events-none"
      >
        <div className="animation-bat-hang flex flex-col items-center origin-top">
          <div
            className="w-[1px] bg-white/40 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-top"
            style={{
              height: scrolled ? 0 : isMobile ? 36 : 46,
            }}
          />
          <div
            className={`pointer-events-auto cursor-pointer transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              scrolled
                ? "opacity-0 scale-50 pointer-events-none"
                : "opacity-100 scale-100"
            } ${batTease ? "scale-125" : ""}`}
            onMouseEnter={() => setBatTease(true)}
            onMouseLeave={() => setBatTease(false)}
          >
            <img
              src={batImg}
              alt="Hanging Bat"
              className="size-9 sm:size-11 select-none"
            />
          </div>
        </div>
      </div>

      {/* 2 · Hanging Spooky Ghost - Between Bat and Spider */}
      <div
        style={{ left: "30%" }}
        className="absolute top-0 flex flex-col items-center pointer-events-none"
      >
        <div className="animation-ghost-float flex flex-col items-center origin-top">
          <div
            className="w-[1px] bg-white/40 transition-all duration-750 delay-40 ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-top"
            style={{
              height: scrolled ? 0 : isMobile ? 48 : 64,
            }}
          />
          <div
            className={`pointer-events-auto cursor-pointer transition-all duration-750 delay-40 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              scrolled
                ? "opacity-0 scale-50 pointer-events-none"
                : "opacity-100 scale-100"
            } ${spookyGhostTease ? "scale-125 rotate-6" : ""}`}
            onMouseEnter={() => setSpookyGhostTease(true)}
            onMouseLeave={() => setSpookyGhostTease(false)}
          >
            <img
              src={ghostSpookyImg}
              alt="Hanging Spooky Ghost"
              className="size-8 sm:size-10 select-none"
            />
          </div>
        </div>
      </div>

      {/* 3 · Hanging Spider - Center Position */}
      <div
        style={{ left: "50%" }}
        className="absolute top-0 -translate-x-1/2 flex flex-col items-center pointer-events-none"
      >
        <div className="animation-spider-bob flex flex-col items-center origin-top">
          <div
            className="w-[1px] bg-white/40 transition-all duration-800 delay-80 ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-top"
            style={{
              height: scrolled ? 0 : isMobile ? 38 : 50,
            }}
          />
          <div
            className={`pointer-events-auto cursor-pointer transition-all duration-800 delay-80 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              scrolled
                ? "opacity-0 scale-50 pointer-events-none"
                : "opacity-100 scale-100"
            } ${spiderTease ? "scale-125" : ""}`}
            onMouseEnter={() => setSpiderTease(true)}
            onMouseLeave={() => setSpiderTease(false)}
          >
            <img
              src={spiderImg}
              alt="Hanging Spider"
              className="size-10 sm:size-12 select-none"
            />
          </div>
        </div>
      </div>

      {/* 4 · Hanging Kiro Ghost - Right Center */}
      <div
        style={{ left: "68%" }}
        className="absolute top-0 flex flex-col items-center pointer-events-none"
      >
        <div className="animation-kiro-float flex flex-col items-center origin-top">
          <div
            className="w-[1px] bg-white/40 transition-all duration-750 delay-130 ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-top"
            style={{
              height: scrolled ? 0 : isMobile ? 50 : 66,
            }}
          />
          <div
            className={`pointer-events-auto cursor-pointer transition-all duration-750 delay-130 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              scrolled
                ? "opacity-0 scale-50 pointer-events-none"
                : "opacity-100 scale-100"
            } ${kiroTease ? "scale-125 rotate-6" : ""}`}
            onMouseEnter={() => setKiroTease(true)}
            onMouseLeave={() => setKiroTease(false)}
          >
            <img
              src={kiroGhostImg}
              alt="Hanging Kiro Ghost"
              className="w-6 sm:w-7.5 h-auto select-none"
            />
          </div>
        </div>
      </div>

      {/* 5 · Hanging Pumpkin - Far Right */}
      <div
        style={{ left: "84%" }}
        className="absolute top-0 flex flex-col items-center pointer-events-none"
      >
        <div className="animation-pumpkin-sway flex flex-col items-center origin-top">
          <div
            className="w-[1px] bg-white/40 transition-all duration-800 delay-180 ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-top"
            style={{
              height: scrolled ? 0 : isMobile ? 52 : 70,
            }}
          />
          <div
            className={`pointer-events-auto cursor-pointer transition-all duration-800 delay-180 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              scrolled
                ? "opacity-0 scale-50 pointer-events-none"
                : "opacity-100 scale-100"
            } ${pumpkinTease ? "scale-125" : ""}`}
            onMouseEnter={() => setPumpkinTease(true)}
            onMouseLeave={() => setPumpkinTease(false)}
          >
            <img
              src={pumpkinImg}
              alt="Hanging Pumpkin"
              className="size-9 sm:size-11 select-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
