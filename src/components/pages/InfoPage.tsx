import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  BookOpen,
  Scale,
  ShieldCheck,
  FileText,
  AlertTriangle,
  Cookie,
  Info,
  Sparkles,
  Mail,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { REPO_URL } from "../../config/site";

export type InfoPageId =
  | "docs"
  | "license"
  | "privacy"
  | "terms"
  | "disclaimer"
  | "cookies"
  | "about"
  | "credits"
  | "contact";

interface PageMeta {
  id: InfoPageId;
  label: string;
  category: "Resources" | "Legal" | "About";
  icon: typeof BookOpen;
}

export const INFO_PAGES: PageMeta[] = [
  // Resources
  { id: "docs", label: "Documentation", category: "Resources", icon: BookOpen },
  { id: "license", label: "MIT License", category: "Resources", icon: Scale },
  // Legal
  { id: "privacy", label: "Privacy Policy", category: "Legal", icon: ShieldCheck },
  { id: "terms", label: "Terms of Use", category: "Legal", icon: FileText },
  { id: "disclaimer", label: "Disclaimer", category: "Legal", icon: AlertTriangle },
  { id: "cookies", label: "Cookie Policy", category: "Legal", icon: Cookie },
  // About
  { id: "about", label: "About SCAMMAZE", category: "About", icon: Info },
  { id: "credits", label: "Project Credits", category: "About", icon: Sparkles },
  { id: "contact", label: "Contact", category: "About", icon: Mail },
];

export const INFO_PAGE_IDS = new Set<string>(INFO_PAGES.map((p) => p.id));

interface InfoPageProps {
  pageId: InfoPageId;
  onSelectPage: (id: InfoPageId) => void;
  onBackToHome: () => void;
}

export function InfoPage({ pageId, onSelectPage, onBackToHome }: InfoPageProps) {
  const [selectedId, setSelectedId] = useState<InfoPageId>(pageId);
  const articleRef = useRef<HTMLElement>(null);

  // Sync internal state when external pageId changes (e.g. browser back/forward)
  useEffect(() => {
    setSelectedId(pageId);
  }, [pageId]);

  const handleSelect = (id: InfoPageId) => {
    if (id === selectedId) return;
    setSelectedId(id);
    window.history.replaceState(null, "", `#${id}`);
    onSelectPage(id);

    // Smoothly scroll to article top only if user had scrolled far down
    if (articleRef.current) {
      const rect = articleRef.current.getBoundingClientRect();
      if (rect.top < 90) {
        window.scrollTo({
          top: window.scrollY + rect.top - 100,
          behavior: "smooth",
        });
      }
    }
  };

  const current = INFO_PAGES.find((p) => p.id === selectedId) || INFO_PAGES[0];

  return (
    <div className="min-h-screen bg-[#03060a] text-[#cbd5e1] pt-24 pb-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        
        {/* Top Breadcrumb & Back Link */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-8 mb-8 border-b border-[#1b2233]">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-mono text-[#717b91]">
            <button
              type="button"
              onClick={onBackToHome}
              className="text-[#9d7cf7] hover:text-white transition-colors cursor-pointer"
            >
              SCAMMAZE
            </button>
            <span>/</span>
            <span className="text-[#a0aec0]">{current.category}</span>
            <span>/</span>
            <span className="text-white font-medium">{current.label}</span>
          </div>

          <button
            type="button"
            onClick={onBackToHome}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-[#232938] bg-[#0c101c] hover:bg-[#151c2e] hover:border-[#9d7cf7] text-xs font-mono text-mist hover:text-white transition-all cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Back to Home</span>
          </button>
        </div>

        {/* Mobile Horizontal Category Tabs Strip */}
        <div className="lg:hidden mb-8 overflow-x-auto pb-2 -mx-5 px-5 flex items-center gap-2 scrollbar-none">
          {INFO_PAGES.map((page) => {
            const Icon = page.icon;
            const isSelected = page.id === selectedId;
            return (
              <button
                key={page.id}
                type="button"
                onClick={() => handleSelect(page.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium shrink-0 cursor-pointer border ${
                  isSelected
                    ? "bg-[#1c2233] text-white border-[#3b4765] shadow-sm font-semibold"
                    : "bg-[#0b0e17] text-[#8a93a6] hover:text-white border-transparent hover:bg-[#121624] transition-colors"
                }`}
              >
                <Icon size={14} className={isSelected ? "text-[#9d7cf7]" : "text-[#64748b]"} />
                <span>{page.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          {/* Left Sidebar (Sticky Navigation) */}
          <aside className="hidden lg:block lg:col-span-3 sticky top-28 bg-[#070a12] border border-[#1a1f2f] rounded-2xl p-4 space-y-6">
            {(["Resources", "Legal", "About"] as const).map((category) => {
              const pagesInCategory = INFO_PAGES.filter((p) => p.category === category);
              return (
                <div key={category}>
                  <p className="px-3 pb-2 text-[11px] font-mono font-semibold uppercase tracking-widest text-[#717b91]">
                    {category}
                  </p>
                  <ul className="space-y-1">
                    {pagesInCategory.map((page) => {
                      const Icon = page.icon;
                      const isSelected = page.id === selectedId;
                      return (
                        <li key={page.id}>
                          <button
                            type="button"
                            onClick={() => handleSelect(page.id)}
                            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-left cursor-pointer border ${
                              isSelected
                                ? "bg-[#182035] text-white font-semibold border-[#3b4868] shadow-sm"
                                : "border-transparent text-[#8a96ab] hover:text-white hover:bg-[#0f1422] transition-colors"
                            }`}
                          >
                            <Icon
                              size={16}
                              className={`shrink-0 ${
                                isSelected ? "text-[#9d7cf7]" : "text-[#627088]"
                              }`}
                            />
                            <span className="flex-1 truncate">{page.label}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}

            <div className="pt-2 border-t border-[#1a1f2c]">
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#0b0e17] hover:bg-[#131929] border border-[#192033] text-xs text-[#a0aec0] hover:text-white transition-colors"
              >
                <span className="font-mono">GitHub Repository</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </aside>

          {/* Right Main Article Surface */}
          <article
            ref={articleRef}
            className="lg:col-span-9 bg-[#070a12] border border-[#1a1f2f] rounded-2xl p-6 sm:p-10 lg:p-12 text-[#cbd5e1] leading-relaxed min-h-[500px]"
          >
            {/* Smooth transition container keyed by selected tab */}
            <div key={selectedId} className="animate-tab-page-switch">
              {/* Page Header */}
              <div className="pb-8 mb-8 border-b border-[#1b2233]">
                <span className="text-xs font-mono font-semibold text-[#9d7cf7] uppercase tracking-widest">
                  {current.category}
                </span>
                <h1 className="mt-2 text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight">
                  {current.label}
                </h1>
                <p className="mt-3 text-xs sm:text-sm text-[#717b91] font-mono">
                  SCAMMAZE · First-Person 3D Scam Investigation Game
                </p>
              </div>

              {/* Page Specific Body Content */}
              <div className="space-y-8 text-sm sm:text-[15px] leading-relaxed">
                {selectedId === "docs" && <DocsContent />}
                {selectedId === "license" && <LicenseContent />}
                {selectedId === "privacy" && <PrivacyContent />}
                {selectedId === "terms" && <TermsContent />}
                {selectedId === "disclaimer" && <DisclaimerContent />}
                {selectedId === "cookies" && <CookiesContent />}
                {selectedId === "about" && <AboutContent />}
                {selectedId === "credits" && <CreditsContent />}
                {selectedId === "contact" && <ContactContent />}
              </div>
            </div>

          </article>

        </div>

      </div>
    </div>
  );
}

/* =========================================================================
   PAGE CONTENT IMPLEMENTATIONS
   ========================================================================= */

function DocsContent() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div className="p-5 rounded-2xl bg-[#0d121f] border border-[#1f283d] text-sm text-[#94a3b8] leading-relaxed">
        <strong className="text-white font-semibold">SCAMMAZE Overview:</strong> A first-person 3D narrative game where players walk into interactive environments, investigate suspicious digital traps, and solve realistic scam scenarios through immersive, hands-on detective gameplay.
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white tracking-tight">The Three-Phase Learning Loop</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div className="p-4 rounded-xl bg-[#090d18] border border-[#1a2236]">
            <span className="font-mono text-xs text-[#9d7cf7] font-semibold">01 · EXPLORE</span>
            <h3 className="font-semibold text-white text-base mt-1">Navigate 3D Scenarios</h3>
            <p className="text-xs text-[#8a96a9] mt-2 leading-relaxed">
              Walk through everyday 3D environments from a first-person perspective, discovering unexpected alerts and urgent messages.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#090d18] border border-[#1a2236]">
            <span className="font-mono text-xs text-[#5cc8b2] font-semibold">02 · INSPECT</span>
            <h3 className="font-semibold text-white text-base mt-1">Investigate Clues</h3>
            <p className="text-xs text-[#8a96a9] mt-2 leading-relaxed">
              Examine virtual devices, inspect spoofed domain stems, and uncover deceptive psychological pressure tactics.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#090d18] border border-[#1a2236]">
            <span className="font-mono text-xs text-[#f97316] font-semibold">03 · RESOLVE</span>
            <h3 className="font-semibold text-white text-base mt-1">Solve the Scam</h3>
            <p className="text-xs text-[#8a96a9] mt-2 leading-relaxed">
              Apply investigative checklists, verify authentic channels, and choose the actions that neutralize the deception.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-white tracking-tight">Architecture & Technology Stack</h2>
        <ul className="list-disc list-inside space-y-2 text-[#94a3b8]">
          <li><strong className="text-white">3D Gameplay & WebGL:</strong> Interactive first-person 3D investigation environments rendered directly in the browser with WebGL/Three.js.</li>
          <li><strong className="text-white">Frontend Core:</strong> React 19, TypeScript, Vite 8, Tailwind CSS v4.</li>
          <li><strong className="text-white">Investigation Mechanics:</strong> Interactive device inspection, clue collection, branching NPC dialogs, deterministic scenario simulation engine (`scenario.ts`), and client-side URL heuristics (`urlCheck.ts`).</li>
          <li><strong className="text-white">Safety Architecture:</strong> 100% simulated offline execution. No user network requests to untrusted targets are made; all domains are fictional (.example / internal).</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-white tracking-tight">Local Development</h2>
        <pre className="p-5 rounded-xl bg-[#04060b] border border-[#182033] font-mono text-xs text-[#a5b4fc] overflow-x-auto leading-relaxed">
{`# Clone the repository
git clone https://github.com/teehihi/scam-maze.git

# Install dependencies with pnpm
pnpm install

# Start local development server
pnpm dev

# Build production bundle & typecheck
pnpm build`}
        </pre>
      </section>
    </div>
  );
}

function LicenseContent() {
  const [copied, setCopied] = useState(false);

  const licenseText = `MIT License

Copyright (c) 2026 SCAMMAZE contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

  const handleCopy = () => {
    navigator.clipboard.writeText(licenseText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl bg-[#0d121f] border border-[#1f283d]">
        <div>
          <h2 className="font-semibold text-white text-base">Permissive Open Source License</h2>
          <p className="text-xs text-[#94a3b8] mt-1">
            Free for educational, commercial, private, and community development.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-[#2a344f] bg-[#161e33] hover:bg-[#1f2a47] text-xs font-mono text-white transition-all cursor-pointer"
        >
          {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          <span>{copied ? "Copied" : "Copy License"}</span>
        </button>
      </div>

      <pre className="p-6 rounded-xl bg-[#04060b] border border-[#182033] font-mono text-xs sm:text-sm text-[#cbd5e1] leading-relaxed whitespace-pre-wrap">
        {licenseText}
      </pre>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div className="p-5 rounded-2xl bg-[#0d121f] border border-[#1f283d] text-sm text-[#94a3b8] leading-relaxed">
        <strong className="text-white font-semibold">Zero-Data Collection Promise:</strong> SCAMMAZE is designed with strict privacy-by-default principles. We do not track, collect, sell, or transmit any personal identifiable information (PII).
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-white tracking-tight">1. Client-Side Only Execution</h2>
        <p className="text-[#94a3b8]">
          All gameplay decisions, investigative clues, and scenario branches run entirely inside your browser. No session data, decision trees, or simulated actions are sent to any remote telemetry server.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-white tracking-tight">2. No Tracking Cookies & Telemetry</h2>
        <p className="text-[#94a3b8]">
          This site does not load Google Analytics, Meta Pixel, advertising scripts, or third-party user fingerprinting tools. Your visit is strictly private.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-white tracking-tight">3. Fictional Data Handling</h2>
        <p className="text-[#94a3b8]">
          All simulated banking messages, order numbers, credentials, and identity names shown in the game scenarios are 100% fictional. Never input your real-life passwords, banking PINs, or national identity numbers into any educational simulation.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-white tracking-tight">4. Local Storage</h2>
        <p className="text-[#94a3b8]">
          We may store simple preferences (such as audio volume, completed scenario progress, or dark theme settings) directly in your browser&apos;s HTML5 LocalStorage. You can clear this data at any time via your browser settings.
        </p>
      </section>
    </div>
  );
}

function TermsContent() {
  return (
    <div className="space-y-8 max-w-4xl">
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-white tracking-tight">1. Educational Purpose</h2>
        <p className="text-[#94a3b8]">
          SCAMMAZE is developed exclusively as an educational and research simulation for digital literacy and cybersecurity defense awareness. By accessing this platform, you agree to engage with all simulations in good faith for defensive learning.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-white tracking-tight">2. Prohibited Uses</h2>
        <p className="text-[#94a3b8]">
          You may NOT adapt, reproduce, or repurpose any scenario scripts, domain templates, or social engineering models demonstrated in SCAMMAZE to execute, facilitate, or test real-world phishing campaigns, fraudulent schemes, or unauthorized penetration attacks against third parties.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-white tracking-tight">3. Intellectual Property & Open Source Rights</h2>
        <p className="text-[#94a3b8]">
          The software code for SCAMMAZE is open source under the MIT License. Custom artwork, 3D assets, sound design, and brand identifiers are preserved under fair educational use for the Kiroween 2026 hackathon project.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-white tracking-tight">4. Limitation of Liability</h2>
        <p className="text-[#94a3b8]">
          The project contributors and maintainers provide SCAMMAZE &ldquo;as is&rdquo; without warranties of any kind. Under no circumstances shall the creators be held liable for damages, security compromises, or financial losses incurred through real-world cyber incidents.
        </p>
      </section>
    </div>
  );
}

function DisclaimerContent() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div className="p-5 rounded-2xl bg-[#2e1717] border border-[#522323] text-sm text-[#fca5a5] leading-relaxed">
        <strong className="text-white font-semibold flex items-center gap-2 mb-1">
          <AlertTriangle size={18} className="text-amber-400" />
          Critical Advisory:
        </strong>
        SCAMMAZE is an educational game and digital simulation. It is NOT an active cyber-defense tool, real-time scam verification engine, or professional advisory service.
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-white tracking-tight">No Legal, Financial, or Security Advice</h2>
        <p className="text-[#94a3b8]">
          The content, checklists, and heuristics on this website are educational guidelines designed to stimulate critical thinking. They do not constitute formal legal counsel, financial recommendations, or accredited cybersecurity certification.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-white tracking-tight">Fictional Depictions & Organizations</h2>
        <p className="text-[#94a3b8]">
          Any brand names, corporate logos, telephone numbers, postal addresses, or email formats depicted in game scenarios are entirely simulated for storytelling context. Any resemblance to actual businesses, ongoing legal entities, or living persons is purely coincidental.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-white tracking-tight">Suspecting a Real-World Scam?</h2>
        <p className="text-[#94a3b8]">
          If you believe you or someone you know is currently being targeted by a real scam:
        </p>
        <ul className="list-disc list-inside space-y-2 text-[#94a3b8] pl-2">
          <li><strong>Pause immediately:</strong> Do not click suspicious links or approve two-factor authentication prompts.</li>
          <li><strong>Freeze payment channels:</strong> Contact your bank or payment issuer via the verified phone number printed on the back of your physical card.</li>
          <li><strong>Report to authorities:</strong> In Vietnam, report to the National Cyber Security Centre (NCSC) or local police; internationally, report to your country&apos;s anti-fraud center (e.g. FTC, Action Fraud).</li>
        </ul>
      </section>
    </div>
  );
}

function CookiesContent() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div className="p-5 rounded-2xl bg-[#0d121f] border border-[#1f283d] text-sm text-[#94a3b8] leading-relaxed">
        <strong className="text-white font-semibold">Strictly Essential Storage Only:</strong> We respect your digital footprint. SCAMMAZE operates with zero non-essential or third-party advertising cookies.
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-white tracking-tight">What We Store in Your Browser</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border border-[#202940] rounded-xl overflow-hidden">
            <thead className="bg-[#111624] text-white font-mono uppercase text-[11px]">
              <tr>
                <th className="p-3.5 border-b border-[#202940]">Key / Item</th>
                <th className="p-3.5 border-b border-[#202940]">Storage Type</th>
                <th className="p-3.5 border-b border-[#202940]">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1c2336] text-[#94a3b8]">
              <tr>
                <td className="p-3.5 font-mono text-[#9d7cf7]">scammaze_progress</td>
                <td className="p-3.5">LocalStorage</td>
                <td className="p-3.5">Remembers completed scenario investigations.</td>
              </tr>
              <tr>
                <td className="p-3.5 font-mono text-[#9d7cf7]">scammaze_audio</td>
                <td className="p-3.5">LocalStorage</td>
                <td className="p-3.5">Stores your ambient sound preference (Muted/Unmuted).</td>
              </tr>
              <tr>
                <td className="p-3.5 font-mono text-[#9d7cf7]">dismissed_alert</td>
                <td className="p-3.5">SessionStorage</td>
                <td className="p-3.5">Prevents notification banner from reappearing in same session.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-white tracking-tight">How to Clear Your Data</h2>
        <p className="text-[#94a3b8]">
          You can delete your progress and preferences at any time by clearing your browser cache and offline website data for this domain, or opening DevTools (F12) → Application → Clear Storage.
        </p>
      </section>
    </div>
  );
}

function AboutContent() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div className="space-y-3">
        <span className="font-mono text-xs text-[#9d7cf7] uppercase tracking-wider font-semibold">
          Kiroween 2026 Project
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold text-white">
          Explore the world. Uncover the deception. Change the outcome.
        </h2>
        <p className="text-[#94a3b8] leading-relaxed">
          SCAMMAZE is a browser-based, first-person 3D narrative game where players step directly into everyday environments, investigate suspicious situations, and solve realistic scam scenarios from a hands-on detective perspective.
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-xl font-bold text-white tracking-tight">First-Person 3D Scam Investigation</h3>
        <p className="text-[#94a3b8] leading-relaxed">
          Conventional cybersecurity training relies on dry, predictable multiple-choice quizzes that are quickly forgotten. SCAMMAZE immerses you in a 3D first-person mystery: walk up to virtual workstations, inspect incoming messages, interrogate phantom callers, and examine spoofed websites directly inside the 3D world to dismantle traps before they trigger.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-xl font-bold text-white tracking-tight">Built for Vietnam and Worldwide Audiences</h3>
        <p className="text-[#94a3b8] leading-relaxed">
          While digital scams manifest through local nuances—such as fake brand imposter profiles in Vietnam or IRS/HMRC alerts in Western countries—the underlying deception architectures remain universally identical: manufactured urgency, simulated authority, and artificial scarcity. SCAMMAZE teaches universal defense reflexes that protect you anywhere.
        </p>
      </section>
    </div>
  );
}

function CreditsContent() {
  return (
    <div className="space-y-8 max-w-4xl">
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-white tracking-tight">Core Project & Concept</h2>
        <div className="p-5 rounded-xl bg-[#090d18] border border-[#1a2236] space-y-2">
          <p className="text-white font-medium">SCAMMAZE Core Team</p>
          <p className="text-xs sm:text-sm text-[#94a3b8] leading-relaxed">
            Architected and engineered for the Kiroween 2026 Hackathon, uniting interactive web 3D graphics, cybersecurity research, and narrative design.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-white tracking-tight">Open Source Ecosystem</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
          <div className="p-4 rounded-xl bg-[#0b0f1b] border border-[#1c2438]">
            <p className="font-semibold text-white">React 19 & TypeScript</p>
            <p className="text-[#8896ab] mt-1">Component runtime and type-safe state architecture.</p>
          </div>
          <div className="p-4 rounded-xl bg-[#0b0f1b] border border-[#1c2438]">
            <p className="font-semibold text-white">Vite 8 & Tailwind CSS v4</p>
            <p className="text-[#8896ab] mt-1">Sub-millisecond bundling and responsive styling system.</p>
          </div>
          <div className="p-4 rounded-xl bg-[#0b0f1b] border border-[#1c2438]">
            <p className="font-semibold text-white">Lucide Icons</p>
            <p className="text-[#8896ab] mt-1">Minimalist, modern icon system for UI controls.</p>
          </div>
          <div className="p-4 rounded-xl bg-[#0b0f1b] border border-[#1c2438]">
            <p className="font-semibold text-white">WebGL & Three.js Simulation</p>
            <p className="text-[#8896ab] mt-1">Interactive first-person 3D investigation environments.</p>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold text-white tracking-tight">Visual Art & Audio</h2>
        <p className="text-sm text-[#94a3b8]">
          Halloween seasonal iconography, character artwork, and spooky atmospheric motifs inspired by classic hand-drawn comic illustrations and Halloween folklore.
        </p>
      </section>
    </div>
  );
}

function ContactContent() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div className="p-5 rounded-2xl bg-[#0d121f] border border-[#1f283d] text-sm text-[#94a3b8]">
        <strong className="text-white font-semibold">Community & Feedback:</strong> Have suggestions for new scam scenarios, found a bug, or want to contribute? We welcome pull requests and feedback from researchers worldwide.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="p-5 rounded-xl bg-[#090d18] border border-[#1a2236] hover:border-[#9d7cf7] hover:bg-[#111728] transition-all group flex flex-col justify-between"
        >
          <div>
            <span className="font-mono text-xs text-[#9d7cf7] uppercase font-semibold">Code & Issues</span>
            <h3 className="font-semibold text-white text-base mt-1 group-hover:text-[#c4b5fd]">GitHub Repository</h3>
            <p className="text-xs text-[#8a96a9] mt-2">
              Browse the source code, review open pull requests, and star the project.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-[#a0aec0] group-hover:text-white font-mono">
            <span>github.com/teehihi/scam-maze</span>
            <ExternalLink size={12} />
          </div>
        </a>

        <a
          href={`${REPO_URL}/issues`}
          target="_blank"
          rel="noreferrer noopener"
          className="p-5 rounded-xl bg-[#090d18] border border-[#1a2236] hover:border-[#5cc8b2] hover:bg-[#111728] transition-all group flex flex-col justify-between"
        >
          <div>
            <span className="font-mono text-xs text-[#5cc8b2] uppercase font-semibold">Bug Reports</span>
            <h3 className="font-semibold text-white text-base mt-1 group-hover:text-[#a7f3d0]">Report an Issue</h3>
            <p className="text-xs text-[#8a96a9] mt-2">
              Found a layout issue, typo, or device incompatibility? Submit a ticket directly.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-[#a0aec0] group-hover:text-white font-mono">
            <span>Open Issue Tracker</span>
            <ExternalLink size={12} />
          </div>
        </a>
      </div>

      <section className="space-y-3 p-5 rounded-xl bg-[#060910] border border-[#151c2c]">
        <h3 className="font-semibold text-white text-sm">Security Vulnerability Disclosure</h3>
        <p className="text-xs text-[#94a3b8] leading-relaxed">
          If you discover a security vulnerability in the simulation or website infrastructure, please do not file a public issue. Follow our responsible disclosure guidelines via private repository security advisory on GitHub.
        </p>
      </section>
    </div>
  );
}
