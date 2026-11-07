import { REPO_URL } from "./Header";

export function Footer() {
  return (
    <footer>
      <div className="bg-accent px-5 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Ready to find your way out of the maze?</h2>
          <p className="mt-3 max-w-xl text-lg">Pause for a moment, verify through another channel, and never share your OTP.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#play" className="bg-ink px-6 py-3 font-semibold text-paper hover:bg-zinc-700">
              Play again
            </a>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="border border-ink px-6 py-3 font-semibold hover:bg-ink hover:text-paper"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
      <p className="mx-auto max-w-5xl px-5 py-8 text-sm text-muted">
        SCAMMAZE · Kiroween 2026 project · For educational purposes only. If you think you are being scammed, contact your
        bank and your local authorities right away.
      </p>
    </footer>
  );
}
