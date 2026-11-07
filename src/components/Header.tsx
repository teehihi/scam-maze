export const REPO_URL = "https://github.com/teehihi/scam-maze";

const links = [
  { href: "#problem", label: "Problem" },
  { href: "#everywhere", label: "Worldwide" },
  { href: "#loop", label: "Learning loop" },
  { href: "#play", label: "Try it" },
  { href: "#url-check", label: "URL check" },
  { href: "#kiro", label: "Kiro" },
  { href: "#risks", label: "Risks" },
];

export function Header() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-50 border-b border-line bg-paper">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <a href="#top" className="flex items-center gap-2 font-bold tracking-tight">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={24} height={24} />
            SCAMMAZE
          </a>
          <nav aria-label="Main navigation" className="hidden items-center gap-6 text-sm text-muted lg:flex">
            {links.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-ink">
                {l.label}
              </a>
            ))}
          </nav>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm font-medium underline underline-offset-4 hover:text-accent-ink"
          >
            GitHub
          </a>
        </div>
      </header>
    </>
  );
}
