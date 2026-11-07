import { REPO_URL } from "./Header";

const stats = [
  { k: "3 bước", v: "Tình huống → Tín hiệu → Checklist" },
  { k: "100%", v: "Core chạy offline, không cần AI" },
  { k: "0", v: "Link độc hại thật được tải" },
];

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden px-5 pb-24 pt-20 sm:pt-28">
      <div className="maze-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-grape/40 bg-grape/10 px-3 py-1 font-mono text-xs text-violet-200">
          <span className="animate-flicker" aria-hidden="true">🎃</span>
          Dự án tham dự Kiroween
        </div>

        <h1 className="mt-6 max-w-4xl text-5xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-7xl">
          Thoát khỏi <span className="text-pumpkin">mê cung</span> lừa đảo — trước khi nó dẫn bạn vào ngõ cụt.
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-violet-200/80 sm:text-xl">
          SCAMMAZE luyện nhận diện bẫy Internet bằng tình huống tương tác. Mỗi lựa chọn đổi kịch bản,
          mỗi bước chỉ ra tín hiệu cảnh báo, rồi bạn mang cùng checklist đó ra đời thực.
        </p>

        <div className="mt-9 flex flex-wrap gap-3">
          <a
            href="#choi-thu"
            className="rounded-xl bg-pumpkin px-6 py-3 font-semibold text-ink-950 shadow-lg shadow-pumpkin/25 transition hover:brightness-110"
          >
            Chơi thử kịch bản ngay
          </a>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-xl border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-slime hover:text-slime"
          >
            Xem mã nguồn
          </a>
        </div>

        <dl className="mt-16 grid gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.k} className="rounded-2xl border border-white/10 bg-ink-900/70 p-5">
              <dt className="text-3xl font-bold text-slime">{s.k}</dt>
              <dd className="mt-1 text-sm text-violet-200/75">{s.v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div
        className="pointer-events-none absolute right-6 top-24 hidden animate-float select-none text-8xl opacity-80 lg:block"
        aria-hidden="true"
      >
        👻
      </div>
    </section>
  );
}
