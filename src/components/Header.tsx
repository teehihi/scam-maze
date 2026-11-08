import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { useActiveSection } from "../hooks/useActiveSection";
import { useHeaderVisibility } from "../hooks/useHeaderVisibility";
import logoImg from "../assets/logo.png";
import { EnterGameButton } from "./ui/GameEntry";

/** Nav links point at the main sections */
export const NAV_LINKS = [
  { id: "top", label: "Home" },
  { id: "world", label: "World of Scams" },
  { id: "investigate", label: "Investigate" },
  { id: "faq", label: "FAQ" },
] as const;

/** Which nav item each page section belongs to (for active indicator) */
const SECTION_TO_NAV: Record<string, string> = {
  top: "top",
  main: "top",
  world: "world",
  investigation: "world",
  investigate: "investigate",
  process: "investigate",
  faq: "faq",
  debriefs: "faq",
  enter: "faq",
};
const OBSERVED = Object.keys(SECTION_TO_NAV);

export function Header() {
  const { visible, scrolled } = useHeaderVisibility();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const activeSection = useActiveSection(OBSERVED);
  const activeNav = activeSection ? SECTION_TO_NAV[activeSection] : null;

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    setOpen(false);

    const target = document.getElementById(targetId);

    // If target doesn't exist in DOM (e.g. currently viewing an InfoPage), navigate via hash
    if (!target) {
      window.location.hash = `#${targetId}`;
      return;
    }

    if (targetId === "top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.location.hash = "#top";
      return;
    }

    // Set navigating flag to bypass sticky friction
    (window as unknown as { __isNavigating: boolean }).__isNavigating = true;
    setTimeout(() => {
      (window as unknown as { __isNavigating: boolean }).__isNavigating = false;
    }, 1100);

    const targetRect = target.getBoundingClientRect();
    const offset = targetId === "world" ? 80 : 70;
    const targetTop = window.scrollY + targetRect.top - offset;

    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth",
    });

    window.location.hash = `#${targetId}`;
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:bg-purple focus:px-4 focus:py-2 focus:text-white font-semibold"
      >
        Skip to main content
      </a>
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-350 ease-out ${
          !visible && !open
            ? "-translate-y-full opacity-0 pointer-events-none"
            : "translate-y-0 opacity-100 pointer-events-auto"
        } ${
          scrolled || open
            ? "border-hairline bg-graphite/85 backdrop-blur-md shadow-lg"
            : "border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <a
            href="#top"
            onClick={(e) => handleNavClick(e, "top")}
            className="flex items-center gap-2.5 font-display text-lg font-extrabold tracking-[0.12em] text-ivory hover:text-lavender transition-colors group"
          >
            <img
              src={logoImg}
              alt="SCAMMAZE Logo"
              className="size-8 sm:size-9 object-contain transition-transform duration-300 group-hover:scale-105"
            />
            <span>SCAMMAZE</span>
          </a>

          <nav aria-label="Main navigation" className="hidden items-center gap-8 lg:flex">
            {NAV_LINKS.map((l) => {
              const current = activeNav === l.id;
              return (
                <a
                  key={l.id}
                  href={`#${l.id}`}
                  onClick={(e) => handleNavClick(e, l.id)}
                  aria-current={current ? "location" : undefined}
                  className={`label relative py-2 transition-colors hover:text-white ${
                    current ? "text-white font-semibold" : "text-mist"
                  }`}
                >
                  {l.label}
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-0 -bottom-0.5 h-0.5 origin-left bg-lavender transition-transform duration-300 ${
                      current ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </a>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <EnterGameButton
              variant="primary"
              className="hidden !min-h-10 !px-5 !text-xs sm:inline-flex"
            />
            <button
              ref={toggleRef}
              type="button"
              className="grid size-11 place-items-center rounded-lg border border-hairline text-ivory transition-colors hover:border-lavender hover:text-lavender lg:hidden"
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>

        <nav
          id="mobile-menu"
          aria-label="Mobile navigation"
          hidden={!open}
          className="border-t border-hairline bg-graphite/95 px-5 pb-6 pt-2 lg:hidden"
        >
          <ul>
            {NAV_LINKS.map((l) => (
              <li key={l.id} className="border-b border-hairline">
                <a
                  href={`#${l.id}`}
                  onClick={(e) => handleNavClick(e, l.id)}
                  aria-current={activeNav === l.id ? "location" : undefined}
                  className={`display flex min-h-14 items-center justify-between text-xl ${
                    activeNav === l.id ? "text-lavender" : "text-ivory"
                  }`}
                >
                  {l.label}
                  <span aria-hidden="true" className="label text-mist">
                    ↓
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <EnterGameButton variant="primary" className="mt-6 w-full" />
        </nav>
      </header>
    </>
  );
}
