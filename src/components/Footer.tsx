import { REPO_URL } from "../config/site";
import { MazeMotif } from "./art/MazeMotif";

const footerLinks = [
  { href: "#experience", label: "The Experience" },
  { href: "#world", label: "Digital World" },
  { href: "#missions", label: "Missions" },
  { href: "#about", label: "About" },
  { href: "#safety", label: "Safety" },
];

export function Footer() {
  return (
    <footer className="border-t border-hairline bg-graphite px-5 py-14 sm:px-8">
      <div className="mx-auto grid max-w-[76rem] gap-10 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <a href="#top" className="inline-flex items-center gap-3 font-display text-xl font-extrabold tracking-[0.12em]">
            <MazeMotif className="size-8 text-lavender" weight={9} />
            SCAMMAZE
          </a>
          <p className="label mt-4 text-[10px] text-lavender">The internet is the game</p>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-mist">
            A game in development. Everything on this site describes planned features, and every person, company and
            address shown is fictional.
          </p>
        </div>

        <nav aria-label="Footer" className="lg:col-span-4">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-3">
            {footerLinks.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="label text-[11px] text-mist transition-colors hover:text-lavender">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="lg:col-span-3">
          <p className="label text-[10px] text-mist">Project</p>
          <p className="mt-3 text-sm text-mist">A Kiroween 2026 project. Open source under the MIT license.</p>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="label mt-3 inline-block text-[11px] text-lavender underline underline-offset-4 hover:text-white"
          >
            View on GitHub
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </div>

      <p className="mx-auto mt-12 max-w-[76rem] border-t border-hairline pt-6 text-xs leading-relaxed text-mist">
        For educational purposes only. If you think you are being scammed, contact your bank and your local authorities right
        away.
      </p>
    </footer>
  );
}
