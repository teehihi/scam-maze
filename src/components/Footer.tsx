import { ExternalLink } from "lucide-react";
import { REPO_URL } from "../config/site";
import logoImg from "../assets/logo.png";
import { useGameEntry } from "./ui/GameEntry";

export function Footer() {
  const { openEntry } = useGameEntry();

  return (
    <footer className="relative isolate pt-8 sm:pt-10 pb-5 sm:pb-6 overflow-hidden bg-[#171521] text-[#cbd5e1]">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 relative z-10">
        
        {/* Top Section: Multi-column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8 text-left">
          
          {/* Brand Column (Col 1-4) */}
          <div className="lg:col-span-4 flex flex-col items-start pr-0 lg:pr-6">
            <a
              href="#top"
              className="inline-flex items-center gap-3 font-display text-2xl sm:text-3xl text-ivory tracking-wider hover:text-lavender transition-colors group"
            >
              <img
                src={logoImg}
                alt="SCAMMAZE Logo"
                className="size-9 sm:size-10 object-contain transition-transform duration-300 group-hover:scale-105"
              />
              <span>SCAMMAZE</span>
            </a>

            <p className="mt-3.5 text-sm sm:text-base font-semibold text-white/90 leading-snug">
              Explore the world. Uncover the deception. Change the outcome.
            </p>

            <p className="mt-2 text-xs sm:text-sm text-mist/80 leading-relaxed max-w-sm">
              An interactive 3D narrative game that turns real-world-inspired scam scenarios into immersive learning experiences.
            </p>
          </div>

          {/* Links Columns (Col 5-12) */}
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-8">
            
            {/* 1. EXPLORE */}
            <div>
              <h3 className="font-mono text-xs uppercase tracking-widest text-lavender font-bold mb-4">
                Explore
              </h3>
              <ul className="space-y-2.5 text-xs sm:text-sm">
                <li>
                  <button
                    type="button"
                    onClick={openEntry}
                    className="text-mist hover:text-white transition-colors cursor-pointer text-left"
                  >
                    The Game
                  </button>
                </li>
                <li>
                  <a
                    href="#world"
                    className="text-mist hover:text-white transition-colors block"
                  >
                    World of Scams
                  </a>
                </li>
                <li>
                  <a
                    href="#investigate"
                    className="text-mist hover:text-white transition-colors block"
                  >
                    How to Play
                  </a>
                </li>
                <li>
                  <a
                    href="#faq"
                    className="text-mist hover:text-white transition-colors block"
                  >
                    FAQ
                  </a>
                </li>
              </ul>
            </div>

            {/* 2. RESOURCES */}
            <div>
              <h3 className="font-mono text-xs uppercase tracking-widest text-lavender font-bold mb-4">
                Resources
              </h3>
              <ul className="space-y-2.5 text-xs sm:text-sm">
                <li>
                  <a
                    href={REPO_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 text-mist hover:text-white transition-colors"
                  >
                    <span>GitHub Repository</span>
                    <ExternalLink size={12} className="opacity-60" />
                  </a>
                </li>
                <li>
                  <a
                    href="#docs"
                    className="text-mist hover:text-white transition-colors block"
                  >
                    Documentation
                  </a>
                </li>
                <li>
                  <a
                    href="#license"
                    className="text-mist hover:text-white transition-colors block"
                  >
                    MIT License
                  </a>
                </li>
                <li>
                  <a
                    href={`${REPO_URL}/issues`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 text-mist hover:text-white transition-colors"
                  >
                    <span>Report an Issue</span>
                    <ExternalLink size={12} className="opacity-60" />
                  </a>
                </li>
              </ul>
            </div>

            {/* 3. LEGAL */}
            <div>
              <h3 className="font-mono text-xs uppercase tracking-widest text-lavender font-bold mb-4">
                Legal
              </h3>
              <ul className="space-y-2.5 text-xs sm:text-sm">
                <li>
                  <a
                    href="#privacy"
                    className="text-mist hover:text-white transition-colors block"
                  >
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a
                    href="#terms"
                    className="text-mist hover:text-white transition-colors block"
                  >
                    Terms of Use
                  </a>
                </li>
                <li>
                  <a
                    href="#disclaimer"
                    className="text-mist hover:text-white transition-colors block"
                  >
                    Disclaimer
                  </a>
                </li>
                <li>
                  <a
                    href="#cookies"
                    className="text-mist hover:text-white transition-colors block"
                  >
                    Cookie Policy
                  </a>
                </li>
              </ul>
            </div>

            {/* 4. ABOUT */}
            <div>
              <h3 className="font-mono text-xs uppercase tracking-widest text-lavender font-bold mb-4">
                About
              </h3>
              <ul className="space-y-2.5 text-xs sm:text-sm">
                <li>
                  <a
                    href="#about"
                    className="text-mist hover:text-white transition-colors block"
                  >
                    About SCAMMAZE
                  </a>
                </li>
                <li>
                  <a
                    href="#credits"
                    className="text-mist hover:text-white transition-colors block"
                  >
                    Project Credits
                  </a>
                </li>
                <li>
                  <a
                    href="#contact"
                    className="text-mist hover:text-white transition-colors block"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>

          </div>
        </div>

        {/* Divider */}
        <hr className="border-[#1b2233] mt-8 mb-4" />

        {/* Bottom Section: Copyright & Educational Disclaimer */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-left">
          <p className="text-xs font-mono text-mist/90">
            © 2026 SCAMMAZE. Open source under the MIT License.
          </p>
        </div>

        <p className="mt-2 text-[11px] sm:text-xs leading-relaxed text-mist/60 text-left max-w-4xl">
          SCAMMAZE is an educational simulation. All characters, organizations, messages, and scenarios are fictional. This project is not a real-time scam detection service and does not provide financial, legal, or cybersecurity advice.
        </p>

      </div>
    </footer>
  );
}
