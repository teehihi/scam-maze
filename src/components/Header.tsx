export const REPO_URL = "https://github.com/teehihi/scam-maze";

const links = [
  { href: "#van-de", label: "Vấn đề" },
  { href: "#vong-lap", label: "Vòng lặp học" },
  { href: "#choi-thu", label: "Chơi thử" },
  { href: "#kiem-tra-url", label: "Kiểm tra URL" },
  { href: "#kiro", label: "Kiro" },
  { href: "#rui-ro", label: "Rủi ro" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-ink-950/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <a href="#top" className="flex items-center gap-2 font-bold tracking-tight text-white">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={28} height={28} />
          SCAM<span className="text-pumpkin">MAZE</span>
        </a>
        <nav aria-label="Điều hướng chính" className="hidden items-center gap-6 text-sm text-violet-200/80 lg:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="transition hover:text-white">
              {l.label}
            </a>
          ))}
        </nav>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-full border border-white/15 px-4 py-1.5 text-sm font-medium text-white transition hover:border-pumpkin hover:text-pumpkin"
        >
          GitHub ↗
        </a>
      </div>
    </header>
  );
}
