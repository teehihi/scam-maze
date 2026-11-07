import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { useActiveSection } from "../hooks/useActiveSection";
import { useScrolled } from "../hooks/useScrolled";
import { MazeMotif } from "./art/MazeMotif";
import { EnterGameButton } from "./ui/GameEntry";

/** Nav links point at real section anchors on this page. */
export const NAV_LINKS = [
  { id: "experience", label: "The Experience" },
  { id: "world", label: "Digital World" },
  { id: "missions", label: "Missions" },
  { id: "about", label: "About" },
] as const;

/** Which nav item each page section belongs to (for the active state). */
const SECTION_TO_NAV: Record<string, string> = {
  experience: "experience",
  world: "world",
  investigation: "experience",
  branching: "experience",
  systems: "experience",
  missions: "missions",
  about: "about",
  safety: "about",
};
const OBSERVED = Object.keys(SECTION_TO_NAV);

export function Header() {
  const scrolled = useScrolled();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const activeSection = useActiveSection(OBSERVED);
  const activeNav = activeSection ? SECTION_TO_NAV[activeSection] : null;

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
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:bg-purple focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-500 ${
          scrolled || open
            ? "border-hairline bg-graphite/85 backdrop-blur-md"
            : "border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <a href="#top" className="flex items-center gap-3 font-display text-lg font-extrabold tracking-[0.12em]">
            <MazeMotif className="size-7 text-lavender" weight={9} />
            SCAMMAZE
          </a>

          <nav aria-label="Main navigation" className="hidden items-center gap-9 lg:flex">
            {NAV_LINKS.map((l) => {
              const current = activeNav === l.id;
              return (
                <a
                  key={l.id}
                  href={`#${l.id}`}
                  aria-current={current ? "location" : undefined}
                  className={`label relative py-2 transition-colors hover:text-white ${
                    current ? "text-white" : "text-mist"
                  }`}
                >
                  {l.label}
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-0 -bottom-0.5 h-px origin-left bg-lavender transition-transform duration-500 ${
                      current ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </a>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <EnterGameButton className="hidden !min-h-10 !px-5 sm:inline-flex" />
            <button
              ref={toggleRef}
              type="button"
              className="grid size-11 place-items-center border border-hairline text-ivory transition-colors hover:border-lavender lg:hidden"
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
                  onClick={() => setOpen(false)}
                  aria-current={activeNav === l.id ? "location" : undefined}
                  className={`display flex min-h-14 items-center justify-between text-2xl ${
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
          <EnterGameButton className="mt-6 w-full" />
        </nav>
      </header>
    </>
  );
}
